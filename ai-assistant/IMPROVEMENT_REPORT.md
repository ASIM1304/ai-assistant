# Improvement report

## Quick start
```
cd server && cp .env.example .env   # fill JWT_SECRET, GROQ_API_KEY, MONGO_URI
npm install
npm run migrate:legacy              # ONLY if you have v1 data (back up first)
ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='long-strong-pass' npm run seed:admin   # admins sign in at /admin/login
npm start
cd ../client && cp .env.example .env.local && npm install && npm run dev
```
Requires Node >= 22.13. Tests: `cd server && npm test` (needs a MongoDB at TEST_MONGO_URI or 127.0.0.1:27017).

## Already implemented (preserved)
bcrypt registration/login, Groq question/feedback flow, coding questions (#4, #8), resume analysis,
in-browser face detection (face-api.js), tab-switch/no-face warnings, voice mode, history dashboard.

## Added / changed
- **Auth**: httpOnly cookie session + server-side session records (logout/revocation, 8h absolute, 60m idle),
  per-session CSRF token, roles (candidate/admin), strong password policy (bcrypt cost 12), lockout after 5 failures,
  rate limits, e-mail verification, password reset (single-use, revokes sessions), change password.
- **Interview engine** (backend-owned): consent -> ready -> in_progress -> completed/terminated/abandoned/expired;
  server clock, question numbers (unique index), counters, scoring, completion. Adaptive difficulty with safeguards,
  duplicate-question detection, skips, short-answer re-prompt, idempotent answers, AI-failure retry/fallback, crash self-healing.
- **Scoring**: AI gives 0-10 on 7 criteria; totals computed by fixed weights in our code. Real per-criterion report
  (the old UI invented sub-scores from one number and defaulted to 75).
- **Proctoring**: configurable events/severity/limits (notify -> review -> terminate), server timestamps, heartbeat gaps.
  Events are flags, never verdicts.
- **Privacy**: consent screen (versioned, recorded), no audio/video stored, resume file not stored, export + self-delete,
  retention sweeper, admin sees masked e-mail only and every view is audit-logged.
- **Admin / candidate separation**: admins live in their own `admins` collection with their own login (`/admin/login`), session cookie (`asid`) and CSRF token. No admin registration route. A candidate session is rejected by every admin endpoint and an admin session by every candidate endpoint.
- **Admin portal** (`/admin`): interviews + flag review, candidates (enable/disable/delete), roles & categories, settings, activity log. Admin API also supports scheduling interviews.
- **Interview screen**: fixed-height layout; answer box and Submit/Skip stay pinned at the bottom of the screen, only the history scrolls.
- **Hardening**: helmet, strict CORS allow-list, 100kb body limit, zod strict schemas (mass-assignment/NoSQL injection),
  operator-key guard, generic 500s with request id, prompt-injection delimiting, resume content sniffing.

## Files
Server: fully restructured under `server/src` (config, models x12, middleware, services, controllers, routes), `scripts/`, `test/`.
Client: `lib/{auth,axios,adminAxios,errors}.ts`, `app/admin/**`, `context/Authcontext.tsx`, `components/{InterviewContent,WebcamMonitor,AuthShell,PasswordRules}.tsx`,
pages `login`, `register`, `forgot-password`, `reset-password`, `verify-email`, `reports/[id]`; small dashboard patches.

## Database
New collections: sessions, authtokens, resumes, jobroles, questioncategories, settings, questions, securityevents,
interviewreports, auditlogs. `users.password` -> `passwordHash`; `interviews` restructured (migration script provided).

## API (breaking)
Removed `/api/interviews/start`, `/submit-answer`, `/:id/warning`, `/complete`. New: `/api/interviews` (create),
`/:id/consent|start|state|answer|skip|events|heartbeat|abandon|report`, `/api/profile`(+export/delete), `/api/config/*`, `/api/admin/*`.

## Pros / disadvantages
Camera: verification & integrity vs privacy, permission friction, false flags. AI scoring: fast/consistent vs errors/bias.
Recording: not implemented on purpose (storage + privacy). Anti-cheat: deterrent vs false positives, bypassable client.
Adaptive: better signal vs complexity and AI misjudgment (mitigated by confidence/reliability guard).
Resume AI: faster screening vs misreads/bias.

## Testing performed
77 automated backend tests, all passing, on a real MongoDB-compatible server (FerretDB): auth, lockout, rate limit, CSRF,
JWT forgery, NoSQL injection, RBAC/IDOR, full interview flow, tampering, adaptivity, AI failure, timers, proctoring,
privacy export/delete, retention, resume upload, migration. `npm audit`: 0 vulnerabilities (server).
Client: TypeScript type-check passes.

## NOT tested / remaining limitations
- **Client UI was not run in a browser** (no browser here): interview flow, webcam, voice, report page need manual QA.
- Real Groq responses were not exercised (a fake model was used); real Mongo (not FerretDB) not used; TTL not used.
- Admin portal and the new interview layout are untested in a browser. No candidate profile page yet (API exists). Admin password reset is via `npm run seed:admin` (no e-mail flow).
- Client-side proctoring can be bypassed by a determined user; no identity verification beyond attestation + face presence.
- Browser speech recognition may send audio to the browser vendor (disclosed in the consent notice).
- Not claimed: "completely secure" or "cheat-proof".

## Production checklist
HTTPS everywhere; set JWT_SECRET, CORS_ORIGINS (https), COOKIE_SAMESITE, TRUST_PROXY behind a proxy; SMTP configured;
managed MongoDB with auth + backups; secrets in a secret manager; rotate any previously exposed keys; review privacy text
with counsel; monitor logs; consider Redis-backed rate limiting if running multiple instances; add browser E2E tests.

---
# PHASE 1 (this iteration): smarter engine, richer evaluation, reports

## Codebase audit (verified before changes)
Baseline: 68/68 backend tests passed before any change. Gaps found:
1. Difficulty moved on a single score (one misleading evaluation could swing the interview).
2. Questions never built on the previous answer (no follow-ups).
3. Duplicate detection was word-overlap only.
4. Only a "technical" interview existed; no behavioral/HR/resume/job-description modes; question count & duration not candidate-configurable.
5. Evaluation had no per-criterion explanations, no quoted evidence, no model answer, no suggestions.
6. Reports had no skill-wise breakdown or practice plan; no trends view; no download.

## Implemented in Phase 1 (all with automated tests)
- **Multi-evaluation adaptive difficulty** (`services/adaptive.js`): weighted window of the last <=3 reliable scores at the current level; two agreeing scores needed to move, unless the latest is extreme (>=92 up / <=20 down); window resets after a change; failed/low-confidence evaluations never count.
- **Follow-up questions**: when an answer was decent but incomplete (score 25-74), the next question probes that gap, using the previous answer (as untrusted data). Max ~30% of questions, never twice in a row, never after coding. Admin toggle `followUps`.
- **Similar-question detection**: keyword Jaccard + containment (`isSimilarQuestion`), also applied to the built-in fallback bank.
- **Interview types**: technical, behavioral, HR, resume-based, job-description-based. Candidate chooses type, question count and duration within admin-set limits (`settings.interview.limits`), validated on the server.
- **Resume + job grounding**: resume analysis now extracts projects, technologies, years; job descriptions are analysed into required skills/responsibilities; a deterministic resume-vs-job skill match (`services/matching.js`, `POST /api/resume/match`) lists matched/missing skills and is always labelled as *claims, not verified*. Questions may only reference what is in the supplied context. Resume, job description and answers are delimited as untrusted data.
- **Richer evaluation** (7 criteria kept; totals still computed only by backend code): per-criterion explanations, strengths, improvements, suggestions, model answer, and quoted evidence. **The backend verifies every evidence quote really occurs in the candidate's answer** and discards the rest (the count of rejected quotes is stored).
- **Reports**: skill-wise (per-topic) scores, 0-100 criteria profile, practice plan (AI, with rule-based fallback labelled as such), interview type, follow-up count; model answers/evidence only revealed after the interview.
- **Candidate dashboard**: new `/progress` page (trend chart, by-criterion, by-topic, latest practice plan) from `GET /api/interviews/stats/trends` (own data only; legacy/unevaluated excluded). Report page: downloads (.md, .json), print/PDF.
- **`npm run ai:smoke`**: checks the prompts/schemas against the REAL Groq model with your key (good>poor scoring, prompt-injection resistance, no invented skills, evidence quotes).

## NOT implemented yet (be aware before calling the project "ready")
- **Coding module** (editor, languages, test cases, run output, complexity feedback). Needs an isolated execution service (e.g. containers/gVisor/Firecracker with CPU, memory, time, no-network limits). It must NOT run inside the API process, so I did not fake it. Coding questions remain text answers evaluated by AI (not executed).
- **Voice improvements** (pause/resume/retry, editable transcript, better TTS). The existing voice mode and the third-party speech disclosure in the consent notice are unchanged.
- **Real-AI validation**: not run (no Groq access here). Run `npm run ai:smoke` and play a full interview with your key before trusting prompt quality.
- **Browser testing**: the client type-checks and builds (all 13 routes compile; Google Fonts were stubbed in the sandbox build because fonts could not be downloaded), but no browser run of UI, voice or webcam was possible.
- **Real MongoDB / production checks** (HTTPS, CORS, secrets, SMTP, backups): not verifiable here. See checklist above.

## Known limitations of what was added
- Similar-question detection is lexical: it misses true paraphrases with different words and can flag two questions written from the same sentence template (cost: one regeneration).
- Difficulty thresholds (70/82/45/50, extremes 92/20) are reasonable defaults, not calibrated on real data.
- Evidence verification proves a quote is in the answer, not that the AI's reasoning about it is right.
- Model answers and practice plans are AI-written and can be wrong; no external resources are suggested to avoid invented links.
- Practice plan and skill scores are only as good as a handful of AI-scored answers.

## Files modified/added in Phase 1
Server: `services/{adaptive,matching,ai,interviewEngine,reportService,scoring,settings,privacy,fallbackQuestions}.js`, `utils/text.js`, models `Interview`, `Question`, `InterviewReport`, controllers `interview` (+trends), `resume` (+match), `config`, routes `schemas`, `interview`, `resume`, `scripts/ai-smoke-test.js`, tests (`unit`, `interview`, helpers).
Client: `components/InterviewContent.tsx` (type/count/duration/JD options), `app/reports/[id]/page.tsx`, `app/progress/page.tsx`, `components/Navbar.tsx`.
DB: Interview `+interviewType,+jobDescription`; Question `+isFollowUp,+parentQuestionId,+suggestions,+modelAnswer, evaluation +explanations/evidence`; Report `+interviewType,+skillScores,+criteriaScores,+practicePlan`. All additive (existing documents keep working).
API: `POST /api/interviews` accepts `interviewType, jobDescription, totalQuestions, durationMinutes`; new `GET /api/interviews/stats/trends`, `POST /api/resume/match`.

## Recommended next phases
2. Coding module with an isolated runner service (separate container/host, no network, cgroup limits, short-lived, queue + signed results) behind a feature flag.
3. Voice: pause/resume/retry, editable transcript before submit, TTS controls, per-feature consent.
4. Calibrate prompts/thresholds on real interviews; browser E2E tests (Playwright) for UI, webcam permission flows and voice.
