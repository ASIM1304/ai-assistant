/**
 * Interview engine. The BACKEND is the single source of truth for:
 * question number, status, difficulty, scores, duration, completion, ownership.
 * Nothing in a request body can change those values.
 */
const { Interview, Question, SecurityEvent, JobRole, QuestionCategory, Resume } = require("../models");
const { badRequest, conflict, notFound } = require("../utils/AppError");
const { cleanText, looksLikePromptInjection, isSimilarQuestion } = require("../utils/text");
const { matchSkills } = require("./matching");
const ai = require("./ai");
const { getSettings } = require("./settings");
const { nextDifficulty, bandFor, clampLevel } = require("./adaptive");

const INTERVIEW_TYPES = ["technical", "behavioral", "hr", "resume", "job_description"];
const { scoreFromCriteria, verdictFromScore } = require("./scoring");
const { classify, levelFor, MESSAGES, DESCRIPTIONS } = require("./proctoring");
const { pickFallback } = require("./fallbackQuestions");
const { PRIVACY_VERSION } = require("./privacy");
const { ensureReport } = require("./reportService");
const { currentQuestionView, historyItem, isTerminal } = require("./serializers");

const MAX_EVAL_ATTEMPTS = 3; // after this, the answer is kept but marked "unevaluated"
const HEARTBEAT_GAP_SECONDS = 90;
const MAX_EVENTS_PER_INTERVIEW = 300;

// ── lookup / lifecycle ───────────────────────────────────────────────────────
async function loadOwned(userId, id) {
  const interview = await Interview.findOne({ _id: id, userId });
  // 404 (not 403) so other people's interview ids can't be probed.
  if (!interview) throw notFound("Interview not found", "INTERVIEW_NOT_FOUND");
  return interview;
}

async function resolveRole(keyOrLabel) {
  const q = String(keyOrLabel);
  return (await JobRole.findOne({ key: q, active: true })) || (await JobRole.findOne({ label: q, active: true }));
}

/** Time is enforced by the server clock on every call. */
async function enforceTime(interview) {
  if (interview.status === "in_progress" && interview.deadlineAt && Date.now() > interview.deadlineAt.getTime()) {
    await finalizeInterview(interview, "expired", "time_limit");
    return true;
  }
  return false;
}

const timeUpError = () => conflict("Time is up. Your interview has ended and your report is available.", "INTERVIEW_EXPIRED", { status: "expired" });

function assertInProgress(interview) {
  if (interview.status !== "in_progress")
    throw conflict(`This interview is ${interview.status.replace("_", " ")}.`, "INVALID_STATE", { status: interview.status });
}

async function syncCounters(interviewId) {
  const [answered, skipped] = await Promise.all([
    Question.countDocuments({ interviewId, status: "answered" }),
    Question.countDocuments({ interviewId, status: "skipped" }),
  ]);
  await Interview.updateOne({ _id: interviewId }, { $set: { questionsAnswered: answered, questionsSkipped: skipped } });
  return { answered, skipped };
}

const getOpenQuestion = (interviewId) =>
  Question.findOne({ interviewId, status: { $in: ["asked", "evaluating"] } }).sort({ questionNumber: -1 });

// ── create / consent / start ─────────────────────────────────────────────────
/** Keeps only quotes that really occur in the candidate's answer (the model can hallucinate quotes). */
function verifyEvidence(quotes = [], answer = "") {
  const norm = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const hay = norm(answer);
  const verified = [];
  for (const q of quotes) {
    const n = norm(q);
    if (n.length >= 8 && hay.includes(n)) verified.push(cleanText(q, 250));
  }
  return { verified: verified.slice(0, 3), rejected: quotes.length - verified.length };
}

async function buildContext(user, interviewType, jobDescription) {
  const ctx = {};
  if (user.profile?.skills?.length) ctx.profileSkills = user.profile.skills.slice(0, 12);
  const wantsResume = interviewType === "resume" || interviewType === "job_description";
  let resume = null;
  if (wantsResume) {
    resume = await Resume.findOne({ userId: user._id }).lean();
    if (interviewType === "resume" && !resume?.analysis) throw badRequest("Upload and analyse your resume first to use a resume-based interview.", "RESUME_REQUIRED");
    const a = resume?.analysis;
    if (a)
      ctx.resume = {
        summary: a.summary,
        experienceLevel: a.experienceLevel,
        yearsOfExperience: a.yearsOfExperience ?? undefined,
        skills: a.skillsDetected,
        technologies: a.technologies,
        projects: (a.projects || []).map((p) => ({ name: p.name, description: p.description, technologies: p.technologies })),
      };
  }
  if (jobDescription) {
    let job = null;
    try {
      job = await ai.analyzeJobDescription({ text: jobDescription });
    } catch {
      /* AI unavailable: the raw (delimited) job description is still used for questions */
    }
    if (job) {
      ctx.job = { title: job.title, seniority: job.seniority, requiredSkills: job.requiredSkills, responsibilities: job.responsibilities };
      if (ctx.resume) {
        // Claimed-on-resume vs required: a gap list, NOT a verdict about the candidate's ability.
        ctx.match = matchSkills([...(ctx.resume.skills || []), ...(ctx.resume.technologies || [])], job.requiredSkills);
        ctx.matchNote = "Skills listed on the resume are claims, not verified. Probe understanding fairly; do not assume gaps or proficiency.";
      }
    }
  }
  return Object.keys(ctx).length ? ctx : null;
}

async function createInterview(user, jobRoleInput, opts = {}) {
  const { scheduledFor, scheduledBy } = opts;
  const interviewType = opts.interviewType || "technical";
  if (!INTERVIEW_TYPES.includes(interviewType)) throw badRequest("Unknown interview type", "INVALID_TYPE");
  const role = await resolveRole(jobRoleInput);
  if (!role) throw badRequest("Unknown or inactive job role", "INVALID_ROLE");

  const jobDescription = opts.jobDescription ? cleanText(opts.jobDescription, 6000) : "";
  if (interviewType === "job_description" && jobDescription.length < 80) throw badRequest("Paste the job description (at least a few sentences) for a job-description interview.", "JOB_DESCRIPTION_REQUIRED");

  const running = await Interview.findOne({ userId: user._id, status: "in_progress" });
  if (running) {
    if (running.deadlineAt && Date.now() > running.deadlineAt.getTime()) await finalizeInterview(running, "expired", "time_limit");
    else throw conflict("You already have an interview in progress.", "INTERVIEW_IN_PROGRESS", { interviewId: running.id });
  }

  const s = await getSettings();
  const it = s.interview;
  const L = it.limits;
  const totalQuestions = opts.totalQuestions ?? it.totalQuestions;
  const durationMinutes = opts.durationMinutes ?? it.durationMinutes;
  if (totalQuestions < L.minQuestions || totalQuestions > L.maxQuestions) throw badRequest(`Choose between ${L.minQuestions} and ${L.maxQuestions} questions.`, "INVALID_CONFIG");
  if (durationMinutes < L.minDurationMinutes || durationMinutes > L.maxDurationMinutes) throw badRequest(`Choose a duration between ${L.minDurationMinutes} and ${L.maxDurationMinutes} minutes.`, "INVALID_CONFIG");
  const startDifficulty = opts.startDifficulty || it.startDifficulty;

  if (!scheduledBy) {
    // Self-started, not-yet-begun attempts are superseded by the new one.
    await Interview.updateMany(
      { userId: user._id, status: { $in: ["scheduled", "ready"] }, scheduledBy: { $exists: false } },
      { $set: { status: "abandoned", endReason: "superseded", completedAt: new Date() } },
    );
  }

  let categories = role.categories?.length ? role.categories : [];
  const active = new Set((await QuestionCategory.find({ active: true }).lean()).map((c) => c.name));
  categories = categories.length ? categories.filter((c) => active.has(c)) : [...active];
  if (!categories.length) categories = ["General"];
  if (interviewType === "behavioral") categories = ["Behavioral"];
  if (interviewType === "hr") categories = ["HR & Motivation"];

  const candidateContext = await buildContext(user, interviewType, jobDescription);

  return Interview.create({
    userId: user._id,
    jobRole: role.key,
    domain: role.label,
    interviewType,
    jobDescription: jobDescription || undefined,
    status: "scheduled",
    scheduledFor,
    scheduledBy,
    currentDifficulty: startDifficulty,
    candidateContext,
    config: {
      totalQuestions,
      durationMinutes,
      startDifficulty,
      adaptive: it.adaptive,
      minDifficulty: it.minDifficulty,
      maxDifficulty: it.maxDifficulty,
      // coding questions only make sense in technical-style interviews
      codingQuestionNumbers: ["technical", "job_description"].includes(interviewType) ? it.codingQuestionNumbers.filter((n) => n <= totalQuestions) : [],
      maxSkips: it.maxSkips,
      minAnswerChars: it.minAnswerChars,
      followUps: it.followUps !== false,
      categories,
      proctoring: s.proctoring,
    },
  });
}

async function recordConsent(interview, input) {
  if (interview.status === "ready") return interview; // idempotent
  if (interview.status !== "scheduled") throw conflict("Consent can only be given before the interview starts.", "INVALID_STATE", { status: interview.status });
  const p = interview.config.proctoring;
  if (input.privacyVersion !== PRIVACY_VERSION)
    throw badRequest("The privacy notice has changed. Please review it again.", "PRIVACY_VERSION_MISMATCH", { currentVersion: PRIVACY_VERSION });
  if (!input.privacyAccepted || !input.identityConfirmed)
    throw badRequest("You must accept the privacy notice and confirm your identity to continue.", "CONSENT_REQUIRED");
  if (p.enabled && p.requireCamera && !input.cameraConsent) throw badRequest("Camera consent is required for this interview.", "CONSENT_REQUIRED");
  if (p.enabled && p.requireMicrophone && !input.microphoneConsent) throw badRequest("Microphone consent is required for this interview.", "CONSENT_REQUIRED");

  const updated = await Interview.findOneAndUpdate(
    { _id: interview._id, status: "scheduled" },
    {
      $set: {
        status: "ready",
        consent: {
          privacyVersion: PRIVACY_VERSION,
          acceptedAt: new Date(),
          cameraConsent: !!input.cameraConsent,
          microphoneConsent: !!input.microphoneConsent,
          identityConfirmed: true,
        },
      },
    },
    { new: true },
  );
  return updated || Interview.findById(interview._id);
}

async function startInterview(interview, verification = {}) {
  if (interview.status === "in_progress") return interview;
  if (interview.status !== "ready")
    throw conflict("Accept the privacy notice and complete the device checks before starting.", "INVALID_STATE", { status: interview.status });
  const startedAt = new Date();
  const updated = await Interview.findOneAndUpdate(
    { _id: interview._id, status: "ready" },
    {
      $set: {
        status: "in_progress",
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + interview.config.durationMinutes * 60_000),
        lastHeartbeatAt: startedAt,
        lastActivityAt: startedAt,
        verification: { faceDetected: !!verification.faceDetected, voiceChecked: !!verification.voiceChecked, at: startedAt },
        currentDifficulty: clampLevel(interview.config.startDifficulty, interview.config.minDifficulty, interview.config.maxDifficulty),
      },
    },
    { new: true },
  );
  const fresh = updated || (await Interview.findById(interview._id));
  await ensureOpenQuestion(fresh);
  return Interview.findById(interview._id);
}

// ── questions ────────────────────────────────────────────────────────────────
async function issueNextQuestion(interview) {
  const cfg = interview.config;
  const open = await getOpenQuestion(interview._id);
  if (open) return open;

  const prev = await Question.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean();
  const number = prev.length + 1;
  if (number > cfg.totalQuestions) return null;

  const previousQuestions = prev.map((q) => q.question);
  const last = prev[prev.length - 1];
  const previousBand = last?.evaluation?.score != null ? bandFor(last.evaluation.score) : undefined;
  const difficulty = interview.currentDifficulty;
  const questionType = cfg.codingQuestionNumbers.includes(number) ? "coding" : "behavioral";
  const cats = cfg.categories?.length ? cfg.categories : ["General"];
  const category = questionType === "coding" ? "Coding" : cats[(number - 1) % cats.length];

  // Follow-up: when the previous answer left a gap (decent but incomplete), probe it once -
  // never twice in a row, never after coding, and at most ~30% of the interview.
  const followUpsSoFar = prev.filter((q) => q.isFollowUp).length;
  const canFollowUp =
    cfg.followUps !== false &&
    last?.status === "answered" &&
    last.evaluation?.status === "ok" &&
    !last.isFollowUp &&
    last.questionType !== "coding" &&
    questionType !== "coding" &&
    last.evaluation.score >= 25 &&
    last.evaluation.score < 75 &&
    followUpsSoFar < Math.floor(cfg.totalQuestions * 0.3);
  const followUp = canFollowUp ? { question: last.question, answer: last.answer, improvements: last.improvements } : null;

  let generated = null;
  let source = "ai";
  let isFollowUp = false;
  for (let attempt = 0; attempt < 2 && !generated; attempt++) {
    try {
      const g = await ai.generateQuestion({
        domain: interview.domain,
        category: followUp ? last.category : category,
        difficulty,
        questionType,
        interviewType: interview.interviewType,
        previousQuestions,
        previousBand,
        candidateContext: interview.candidateContext,
        jobDescription: interview.jobDescription,
        followUp,
      });
      if (previousQuestions.some((p) => isSimilarQuestion(p, g.question))) continue; // duplicate: regenerate
      generated = g;
      isFollowUp = !!followUp;
    } catch (err) {
      console.warn("[engine] question generation failed:", err.code || err.message);
      break; // provider down: don't hammer it, use the fallback
    }
  }
  if (!generated) {
    source = "fallback";
    generated = { question: pickFallback({ domain: interview.domain, difficulty, usedQuestions: previousQuestions }), category };
  }

  let q;
  try {
    q = await Question.create({
      interviewId: interview._id,
      userId: interview.userId,
      questionNumber: number,
      question: generated.question,
      category: cleanText(generated.category || (isFollowUp ? last.category : category), 60) || category,
      questionType,
      difficulty,
      source,
      isFollowUp,
      parentQuestionId: isFollowUp ? last._id : undefined,
      askedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) return getOpenQuestion(interview._id); // concurrent request created it first
    throw err;
  }
  await Interview.updateOne({ _id: interview._id }, { $set: { questionsAsked: number, lastActivityAt: new Date() } });
  return q;
}

/** Self-healing: guarantees an in-progress interview has a question (or finishes it). */
async function ensureOpenQuestion(interview) {
  if (interview.status !== "in_progress") return null;
  const open = await getOpenQuestion(interview._id);
  if (open) return open;
  const resolved = await Question.countDocuments({ interviewId: interview._id, status: { $in: ["answered", "skipped"] } });
  if (resolved >= interview.config.totalQuestions) {
    await finalizeInterview(interview, "completed", "all_questions_done");
    return null;
  }
  return issueNextQuestion(interview);
}

// ── state ────────────────────────────────────────────────────────────────────
function timing(interview) {
  const nowMs = Date.now();
  const deadline = interview.deadlineAt?.getTime();
  return {
    serverNow: new Date(nowMs).toISOString(),
    startedAt: interview.startedAt || null,
    deadlineAt: interview.deadlineAt || null,
    durationLimitSeconds: interview.config.durationMinutes * 60,
    remainingSeconds: interview.status === "in_progress" && deadline ? Math.max(0, Math.floor((deadline - nowMs) / 1000)) : null,
    elapsedSeconds: interview.startedAt
      ? Math.round(((interview.completedAt?.getTime() || nowMs) - interview.startedAt.getTime()) / 1000)
      : 0,
  };
}

function proctoringClientConfig(interview) {
  const p = interview.config.proctoring;
  return {
    enabled: p.enabled,
    enabledEvents: Object.entries(p.events).filter(([, r]) => r.enabled).map(([t]) => t),
    requireFullscreen: p.requireFullscreen,
    inactivitySeconds: p.inactivitySeconds,
    warningLimits: p.warningLimits,
  };
}

async function buildState(interviewInput) {
  let interview = interviewInput;
  if (interview.status === "in_progress") {
    if (await enforceTime(interview)) interview = await Interview.findById(interview._id);
    else {
      await ensureOpenQuestion(interview);
      interview = await Interview.findById(interview._id);
    }
  }
  const reveal = isTerminal(interview.status);
  const [questions, open] = await Promise.all([
    Question.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean(),
    interview.status === "in_progress" ? getOpenQuestion(interview._id) : null,
  ]);
  const total = interview.config.totalQuestions;
  const resolved = questions.filter((q) => ["answered", "skipped"].includes(q.status)).length;
  return {
    interview: {
      id: interview.id,
      status: interview.status,
      domain: interview.domain,
      jobRole: interview.jobRole,
      interviewType: interview.interviewType,
      totalQuestions: total,
      questionNumber: open ? open.questionNumber : resolved,
      remainingQuestions: Math.max(0, total - resolved),
      questionsAnswered: questions.filter((q) => q.status === "answered").length,
      questionsSkipped: questions.filter((q) => q.status === "skipped").length,
      skipsRemaining: Math.max(0, interview.config.maxSkips - questions.filter((q) => q.status === "skipped").length),
      difficulty: open?.difficulty || null,
      warningCount: interview.warningCount,
      endReason: interview.endReason || null,
      score: reveal ? interview.score : null,
      reportId: interview.reportId || null,
      ...timing(interview),
    },
    currentQuestion: currentQuestionView(open),
    history: questions.filter((q) => !(open && q._id.equals(open._id))).map((q) => historyItem(q, { reveal })),
    proctoring: proctoringClientConfig(interview),
  };
}

// ── answering ────────────────────────────────────────────────────────────────
async function submitAnswer(interview, { questionId, answer }) {
  if (await enforceTime(interview)) throw timeUpError();
  assertInProgress(interview);
  const cfg = interview.config;

  const question = await Question.findOne({ _id: questionId, interviewId: interview._id, userId: interview.userId });
  if (!question) throw notFound("Question not found", "QUESTION_NOT_FOUND");

  const text = cleanText(answer, 10000);
  if (!text) throw badRequest("Answer cannot be empty. Use Skip if you want to move on.", "EMPTY_ANSWER");

  if (question.status === "answered") {
    // Idempotent replay (client retried after a lost response) - same answer only.
    if (cleanText(question.answer || "", 10000) === text) {
      const state = await buildState(await Interview.findById(interview._id));
      return {
        replay: true,
        result: { questionId: question.id, answered: true, feedback: question.feedback, verdict: question.evaluation?.verdict || null, evaluationStatus: question.evaluation?.status || null },
        state,
      };
    }
    throw conflict("This question was already answered.", "ALREADY_ANSWERED");
  }
  if (question.status === "skipped" || question.status === "unanswered") throw conflict("This question is closed.", "QUESTION_CLOSED");
  if (question.status === "evaluating") throw conflict("Your answer is already being evaluated.", "ANSWER_IN_PROGRESS");

  // Incomplete answers: ask once for more detail, then accept whatever is submitted.
  if (text.length < cfg.minAnswerChars && !question.shortAnswerWarned) {
    await Question.updateOne({ _id: question._id, status: "asked" }, { $set: { shortAnswerWarned: true } });
    return {
      needsMoreDetail: true,
      message: "That answer looks very short. Add more detail, or submit again to continue with it as-is.",
      state: await buildState(await Interview.findById(interview._id)),
    };
  }

  const claimed = await Question.findOneAndUpdate(
    { _id: question._id, status: "asked" },
    { $set: { status: "evaluating", answer: text }, $inc: { evaluationAttempts: 1 } },
    { new: true },
  );
  if (!claimed) throw conflict("Your answer is already being processed.", "ANSWER_IN_PROGRESS");

  const injection = looksLikePromptInjection(text);
  let out = null;
  try {
    out = await ai.evaluateAnswer({ domain: interview.domain, question: claimed.question, answer: text, difficulty: claimed.difficulty, questionType: claimed.questionType, interviewType: interview.interviewType });
  } catch (err) {
    if (err.permanent || claimed.evaluationAttempts < MAX_EVAL_ATTEMPTS) {
      // Release the claim so the candidate can simply retry - nothing is lost.
      await Question.updateOne({ _id: claimed._id, status: "evaluating" }, { $set: { status: "asked" } });
      throw err;
    }
    console.warn("[engine] evaluation gave up after", claimed.evaluationAttempts, "attempts");
  }

  const ev = out ? verifyEvidence(out.evidence, text) : { verified: [], rejected: 0 };
  const evaluation = out
    ? { status: "ok", criteria: out.scores, score: scoreFromCriteria(out.scores), confidence: out.confidence, explanations: out.explanations, evidence: ev.verified, evidenceRejected: ev.rejected }
    : { status: "failed" };
  if (out) evaluation.verdict = verdictFromScore(evaluation.score);

  const answeredAt = new Date();
  const saved = await Question.updateOne(
    { _id: claimed._id, status: "evaluating" },
    {
      $set: {
        status: "answered",
        evaluation,
        feedback: out ? out.feedback : "This answer could not be evaluated automatically because the AI service was unavailable. It is excluded from scoring and marked for manual review.",
        strengths: out?.strengths || [],
        improvements: out?.improvements || [],
        suggestions: out?.suggestions || [],
        modelAnswer: out?.modelAnswer || undefined,
        answeredAt,
        timeSpentSeconds: Math.max(0, Math.min(86400, Math.round((answeredAt - claimed.askedAt) / 1000))),
        promptInjectionSuspected: injection,
      },
    },
  );
  if (!saved.matchedCount) throw conflict("The interview ended before your answer could be saved.", "INTERVIEW_ENDED");

  if (injection) await logSystemEvent(interview, "PROMPT_INJECTION_SUSPECTED");

  // Window of recent RELIABLE scores at the current difficulty (resets after a change), newest last.
  const all = await Question.find({ interviewId: interview._id, status: { $in: ["answered", "skipped"] } }).sort({ questionNumber: 1 }).lean();
  const window = [];
  for (let k = all.length - 1; k >= 0 && all[k].difficulty === claimed.difficulty; k--) {
    const e = all[k].evaluation;
    if (all[k].status === "answered" && e?.status === "ok" && !(typeof e.confidence === "number" && e.confidence < 0.4)) window.unshift(e.score);
  }
  const difficulty = nextDifficulty({ current: claimed.difficulty, scores: window, adaptive: cfg.adaptive, min: cfg.minDifficulty, max: cfg.maxDifficulty, reliable: !!out });
  await Interview.updateOne({ _id: interview._id }, { $set: { currentDifficulty: difficulty, lastActivityAt: answeredAt } });
  return advance(interview._id, claimed._id, { answered: true });
}

async function skipQuestion(interview, { questionId }) {
  if (await enforceTime(interview)) throw timeUpError();
  assertInProgress(interview);
  const cfg = interview.config;
  const question = await Question.findOne({ _id: questionId, interviewId: interview._id, userId: interview.userId });
  if (!question) throw notFound("Question not found", "QUESTION_NOT_FOUND");
  if (question.status !== "asked") throw conflict("This question can no longer be skipped.", "QUESTION_CLOSED");
  const skipped = await Question.countDocuments({ interviewId: interview._id, status: "skipped" });
  if (skipped >= cfg.maxSkips) throw conflict(`You can skip at most ${cfg.maxSkips} question(s).`, "SKIP_LIMIT");

  const now = new Date();
  const closed = await Question.updateOne(
    { _id: question._id, status: "asked" },
    { $set: { status: "skipped", answeredAt: now, timeSpentSeconds: Math.max(0, Math.round((now - question.askedAt) / 1000)), feedback: "Question skipped." } },
  );
  if (!closed.matchedCount) throw conflict("This question can no longer be skipped.", "QUESTION_CLOSED");
  await Interview.updateOne({ _id: interview._id }, { $set: { lastActivityAt: now } }); // difficulty unchanged by a skip
  return advance(interview._id, question._id, { answered: false });
}

/** After a question is resolved: finish the interview or serve the next question. */
async function advance(interviewId, questionId, { answered }) {
  await syncCounters(interviewId);
  let interview = await Interview.findById(interviewId);
  const resolved = interview.questionsAnswered + interview.questionsSkipped;
  const q = await Question.findById(questionId).lean();

  if (resolved >= interview.config.totalQuestions) await finalizeInterview(interview, "completed", "all_questions_done");
  else if (await enforceTime(interview)) {
    /* deadline passed while evaluating: interview closed as expired */
  } else await issueNextQuestion(interview);

  interview = await Interview.findById(interviewId);
  return {
    result: { questionId: questionId.toString(), answered, feedback: q.feedback, verdict: q.evaluation?.verdict || null, evaluationStatus: q.evaluation?.status || null },
    state: await buildState(interview),
  };
}

// ── finishing ────────────────────────────────────────────────────────────────
async function finalizeInterview(interview, status, reason) {
  const completedAt = new Date();
  const endMs = status === "expired" && interview.deadlineAt ? Math.min(completedAt.getTime(), interview.deadlineAt.getTime()) : completedAt.getTime();
  const durationSeconds = interview.startedAt ? Math.max(0, Math.round((endMs - interview.startedAt.getTime()) / 1000)) : 0;

  const updated = await Interview.findOneAndUpdate(
    { _id: interview._id, status: { $in: ["scheduled", "ready", "in_progress"] } },
    { $set: { status, completedAt, durationSeconds, endReason: reason } },
    { new: true },
  );
  if (!updated) return Interview.findById(interview._id); // already finalized elsewhere

  await Question.updateMany({ interviewId: interview._id, status: { $in: ["asked", "evaluating"] } }, { $set: { status: "unanswered" } });
  await syncCounters(interview._id);
  try {
    await ensureReport(updated);
  } catch (err) {
    console.error("[engine] report generation failed (will retry on read):", err.message);
  }
  return Interview.findById(interview._id);
}

// ── proctoring ───────────────────────────────────────────────────────────────
async function logSystemEvent(interview, eventType, durationSeconds = 0) {
  const policy = interview.config.proctoring;
  const cls = classify(eventType, durationSeconds, policy);
  if (!policy.enabled || !cls) return null;
  return SecurityEvent.create({
    interviewId: interview._id,
    userId: interview.userId,
    eventType,
    durationSeconds: Math.round(durationSeconds),
    severity: cls.severity,
    countsTowardLimit: cls.countsTowardLimit,
    description: DESCRIPTIONS[eventType],
    source: "server",
  });
}

async function recordEvent(interview, { eventType, durationSeconds = 0, note, clientTimestamp }) {
  if (await enforceTime(interview)) throw timeUpError();
  assertInProgress(interview);
  const policy = interview.config.proctoring;
  const cls = policy.enabled ? classify(eventType, durationSeconds, policy) : null;
  const limits = policy.warningLimits;
  if (!cls) return { recorded: false, warningCount: interview.warningCount, level: "none", message: "", terminated: false, limits };

  const dup = await SecurityEvent.findOne({ interviewId: interview._id, eventType, timestamp: { $gte: new Date(Date.now() - 2000) } });
  const total = await SecurityEvent.countDocuments({ interviewId: interview._id });
  if (dup || total >= MAX_EVENTS_PER_INTERVIEW) return { recorded: false, warningCount: interview.warningCount, level: "none", message: "", terminated: false, limits };

  const detail = cleanText(note || "", 150);
  await SecurityEvent.create({
    interviewId: interview._id,
    userId: interview.userId,
    eventType,
    timestamp: new Date(), // server time is authoritative
    clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined,
    durationSeconds: Math.round(durationSeconds),
    severity: cls.severity,
    countsTowardLimit: cls.countsTowardLimit,
    description: detail ? `${DESCRIPTIONS[eventType]} (${detail})` : DESCRIPTIONS[eventType],
    source: "client",
  });

  const warningCount = await SecurityEvent.countDocuments({ interviewId: interview._id, countsTowardLimit: true });
  const level = cls.countsTowardLimit ? levelFor(warningCount, limits) : "none";
  const set = { warningCount, lastActivityAt: new Date() };
  await Interview.updateOne({ _id: interview._id }, { $set: set });
  if (level === "review" || level === "terminate") {
    await Interview.updateOne({ _id: interview._id, reviewStatus: "none" }, { $set: { flaggedForReview: true, reviewStatus: "pending" } });
  }
  if (level === "terminate") await finalizeInterview(interview, "terminated", "proctoring_limit");
  return { recorded: true, warningCount, level, message: MESSAGES[level], terminated: level === "terminate", limits };
}

async function heartbeat(interview) {
  if (interview.status !== "in_progress") return { status: interview.status, ...timing(interview) };
  if (await enforceTime(interview)) return { status: "expired", ...timing(await Interview.findById(interview._id)) };
  const last = interview.lastHeartbeatAt || interview.startedAt;
  const gap = (Date.now() - last.getTime()) / 1000;
  if (gap > HEARTBEAT_GAP_SECONDS) await logSystemEvent(interview, "CONNECTION_LOST", gap);
  const updated = await Interview.findByIdAndUpdate(interview._id, { $set: { lastHeartbeatAt: new Date() } }, { new: true });
  return { status: updated.status, ...timing(updated) };
}

module.exports = {
  loadOwned,
  resolveRole,
  createInterview,
  recordConsent,
  startInterview,
  buildState,
  submitAnswer,
  skipQuestion,
  finalizeInterview,
  recordEvent,
  heartbeat,
  enforceTime,
  ensureOpenQuestion,
  timing,
  verifyEvidence,
  INTERVIEW_TYPES,
  MAX_EVAL_ATTEMPTS,
};
