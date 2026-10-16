const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers");
const { lifecycleSweep, retentionSweep } = require("../src/services/maintenance");

let app, admin;
// createdAt is immutable in Mongoose, so backdate through the raw collection.
const backdate = (id, date) => H.models.Interview.collection.updateOne({ _id: new H.mongoose.Types.ObjectId(id) }, { $set: { createdAt: date } });
before(async () => {
  await H.setupDb("adminpriv");
  app = H.createApp();
  admin = await H.createAdmin(app);
});
after(H.teardownDb);
beforeEach(async () => {
  H.fake.reset();
  await admin.put("/api/admin/settings").send({ interview: { totalQuestions: 4, codingQuestionNumbers: [], durationMinutes: 45 }, retention: { interviewDays: 365, resumeDays: 90 } });
});

test("privacy notice is public and states what is/isn't stored, with live retention numbers", async () => {
  const r = await H.request(app).get("/api/config/privacy");
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.body);
  assert.match(text, /NOT recorded, uploaded or stored/);
  assert.match(text, /Groq/);
  assert.match(text, /Google/); // browser speech-recognition disclosure
  assert.match(text, /365 days/);
  await admin.put("/api/admin/settings").send({ retention: { interviewDays: 30 } });
  assert.match(JSON.stringify((await H.request(app).get("/api/config/privacy")).body), /30 days/);
});

test("profile: only own data, sanitised, strict schema, data minimisation", async () => {
  const a = await H.registerCandidate(app, { name: "Alice Example" });
  const b = await H.registerCandidate(app, { name: "Bob Example" });
  const upd = await a.put("/api/profile").send({
    name: "Alice <script>alert(1)</script>Example",
    phone: "+91 98765-43210",
    skills: ["JavaScript", "javascript", "<b>Node</b>"],
    education: [{ degree: "B.Tech", institution: "NIT Warangal", year: 2022 }],
    experience: [{ title: "Dev", company: "Acme", years: 2, summary: "Built things" }],
    selectedJobRole: "React",
  });
  assert.equal(upd.status, 200);
  const u = upd.body.user;
  assert.ok(!/<script>/.test(u.name));
  assert.deepEqual(u.profile.skills, ["JavaScript", "Node"]);
  assert.equal(u.profile.selectedJobRole, "react");
  assert.ok(!JSON.stringify(u).includes("passwordHash"));
  for (const bad of [{ dateOfBirth: "1990-01-01" }, { role: "admin" }, { email: "x@y.co" }, { phone: "call me maybe" }, { selectedJobRole: "nonexistent" }, { skills: new Array(31).fill("x") }]) {
    assert.equal((await a.put("/api/profile").send(bad)).status, 400, JSON.stringify(bad).slice(0, 40));
  }
  // B's profile is unaffected and there is no id in the API to target A from B
  assert.equal((await b.get("/api/profile")).body.user.name, "Bob Example");
  assert.deepEqual((await b.get("/api/profile")).body.user.profile.skills, []);
});

test("admin sees names + masked e-mail only; never phone/education/skills/resume", async () => {
  const c = await H.registerCandidate(app, { email: "private.person@example.com", name: "Private Person" });
  await c.put("/api/profile").send({ phone: "+1 555 0100", skills: ["Secret skill"], education: [{ degree: "PhD" }] });
  const { id } = await H.startInterview(c);
  await c.post(`/api/interviews/${id}/abandon`).send({});
  const list = await admin.get("/api/admin/candidates?search=Private");
  const blob = JSON.stringify(list.body);
  assert.ok(blob.includes("Private Person"));
  assert.ok(!blob.includes("private.person@example.com"));
  assert.match(blob, /p\*+@example\.com/);
  for (const secret of ["555 0100", "Secret skill", "PhD", "passwordHash"]) assert.ok(!blob.includes(secret));
  const detail = JSON.stringify((await admin.get(`/api/admin/interviews/${id}`)).body);
  for (const secret of ["555 0100", "Secret skill", "PhD", "private.person@example.com", "passwordHash"]) assert.ok(!detail.includes(secret), secret);
  const ints = JSON.stringify((await admin.get("/api/admin/interviews")).body);
  assert.ok(!ints.includes("private.person@example.com"));
});

test("admin settings are validated and applied only to NEW interviews (snapshot)", async () => {
  for (const bad of [{ interview: { totalQuestions: 0 } }, { interview: { totalQuestions: 500 } }, { interview: { durationMinutes: 1 } }, { interview: { minDifficulty: "hard", maxDifficulty: "easy" } }, { proctoring: { warningLimits: { reviewAt: 5, terminateAt: 2 } } }, { bogus: 1 }, { interview: { totalQuestions: "10" } }, { proctoring: { events: { NOT_A_TYPE: { enabled: true } } } }]) {
    assert.equal((await admin.put("/api/admin/settings").send(bad)).status, 400, JSON.stringify(bad));
  }
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c); // 4 questions
  await admin.put("/api/admin/settings").send({ interview: { totalQuestions: 7, durationMinutes: 20 } });
  const s = await c.get(`/api/interviews/${id}/state`);
  assert.equal(s.body.interview.totalQuestions, 4); // running interview keeps its rules
  const c2 = await H.registerCandidate(app);
  const second = await H.startInterview(c2);
  assert.equal(second.state.interview.totalQuestions, 7);
  assert.ok(second.state.interview.remainingSeconds <= 20 * 60);
  assert.equal((await c2.put("/api/admin/settings").send({ interview: { totalQuestions: 1 } })).status, 401);
});

test("job roles & categories: admin CRUD, inactive roles can't be selected, used roles can't be deleted", async () => {
  const created = await admin.post("/api/admin/job-roles").send({ label: "Cloud Security", description: "IAM, KMS", categories: ["Fundamentals"] });
  assert.equal(created.status, 201);
  const key = created.body.role.key;
  assert.equal(key, "cloud-security");
  assert.ok((await admin.get("/api/admin/job-roles")).body.roles.some((r) => r.key === key));
  const probe = await H.registerCandidate(app);
  assert.ok((await probe.get("/api/config/roles")).body.roles.some((r) => r.key === key));
  assert.equal((await admin.post("/api/admin/job-roles").send({ label: "Cloud Security" })).status, 409);
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c, key);
  assert.equal((await H.models.Interview.findById(id)).domain, "Cloud Security");
  await c.post(`/api/interviews/${id}/abandon`).send({});
  assert.equal((await admin.delete(`/api/admin/job-roles/${created.body.role.id}`)).status, 409);
  assert.equal((await admin.patch(`/api/admin/job-roles/${created.body.role.id}`).send({ active: false })).status, 200);
  assert.equal((await c.post("/api/interviews").send({ jobRole: key })).status, 400);
  const cat = await admin.post("/api/admin/categories").send({ name: "Security Basics" });
  assert.equal(cat.status, 201);
  assert.equal((await admin.patch(`/api/admin/categories/${cat.body.category.id}`).send({ active: false })).status, 200);
  assert.equal((await c.post("/api/admin/job-roles").send({ label: "Nope Role" })).status, 401);
});

test("disabling a candidate revokes their sessions and blocks login", async () => {
  const c = await H.registerCandidate(app, { email: "disable@example.com" });
  assert.equal((await admin.patch(`/api/admin/candidates/${c.user.id}`).send({ isActive: false })).status, 200);
  assert.equal((await c.get("/api/auth/me")).status, 401);
  const login = await H.request(app).post("/api/auth/login").send({ email: "disable@example.com", password: H.STRONG });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, "ACCOUNT_DISABLED");
  await admin.patch(`/api/admin/candidates/${c.user.id}`).send({ isActive: true });
  assert.equal((await H.request(app).post("/api/auth/login").send({ email: "disable@example.com", password: H.STRONG })).status, 200);
  // admins can't be targeted through candidate endpoints
  assert.equal((await admin.patch(`/api/admin/candidates/${admin.user.id}`).send({ isActive: false })).status, 404);
});

test("admin-scheduled interview shows up for the candidate and follows consent -> start", async () => {
  const c = await H.registerCandidate(app);
  const sch = await admin.post("/api/admin/interviews/schedule").send({ candidateId: c.user.id, jobRole: "python", scheduledFor: new Date(Date.now() + 3600_000).toISOString() });
  assert.equal(sch.status, 201);
  assert.equal(sch.body.interview.status, "scheduled");
  const act = await c.get("/api/interviews/active");
  assert.equal(act.body.interview.id, sch.body.interview.id);
  // starting a self-created interview must not wipe the scheduled one
  await c.post("/api/interviews").send({ jobRole: "react" });
  assert.equal((await H.models.Interview.findById(sch.body.interview.id)).status, "scheduled");
  assert.equal((await c.post(`/api/interviews/${sch.body.interview.id}/consent`).send(H.CONSENT)).status, 200);
  assert.equal((await c.post(`/api/interviews/${sch.body.interview.id}/start`).send({})).status, 200);
});

test("data export is complete and own-only; account deletion requires password and cascades", async () => {
  const c = await H.registerCandidate(app, { email: "gone@example.com" });
  const other = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  await H.answer(c, id, (await c.get(`/api/interviews/${id}/state`)).body.currentQuestion.id, "a reasonably long answer to export");
  await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH" });
  await c.post(`/api/interviews/${id}/abandon`).send({});
  const exp = await c.get("/api/profile/export");
  assert.equal(exp.status, 200);
  assert.match(exp.headers["content-disposition"], /attachment/);
  assert.equal(exp.body.interviews.length, 1);
  assert.equal(exp.body.interviews[0].questions.length, 2); // answered Q1 + the unanswered Q2
  assert.equal(exp.body.interviews[0].securityEvents.length, 1);
  assert.ok(exp.body.interviews[0].report);
  assert.ok(!JSON.stringify(exp.body).includes("passwordHash"));
  assert.equal(exp.body.account.email, "gone@example.com");

  assert.equal((await c.delete("/api/profile").send({ password: "Wrong!Pass123" })).status, 401);
  assert.equal((await c.delete("/api/profile").send({ password: H.STRONG })).status, 200);
  const m = H.models;
  assert.equal(await m.User.countDocuments({ email: "gone@example.com" }), 0);
  for (const model of [m.Interview, m.Question, m.SecurityEvent, m.InterviewReport, m.Session]) assert.equal(await model.countDocuments({ userId: c.user.id }), 0, model.modelName);
  assert.equal((await c.get("/api/auth/me")).status, 401);
  assert.equal((await other.get("/api/auth/me")).status, 200); // other users untouched
});

test("lifecycle sweep expires overdue interviews, abandons silent ones, expires unstarted ones", async () => {
  const mk = async () => {
    const c = await H.registerCandidate(app);
    return { c, ...(await H.startInterview(c)) };
  };
  const overdue = await mk();
  const silent = await mk();
  const fresh = await mk();
  await H.models.Interview.updateOne({ _id: overdue.id }, { $set: { deadlineAt: new Date(Date.now() - 1000) } });
  const old = new Date(Date.now() - 3 * 3600_000);
  await H.models.Interview.updateOne({ _id: silent.id }, { $set: { lastActivityAt: old, lastHeartbeatAt: old } });
  const idle = await H.registerCandidate(app);
  const pending = (await idle.post("/api/interviews").send({ jobRole: "react" })).body.interview.id;
  await backdate(pending, new Date(Date.now() - 48 * 3600_000));

  const out = await lifecycleSweep();
  assert.equal(out.expired, 1);
  assert.equal(out.abandoned, 1);
  assert.equal(out.unstartedExpired, 1);
  assert.equal((await H.models.Interview.findById(overdue.id)).status, "expired");
  assert.equal((await H.models.Interview.findById(silent.id)).status, "abandoned");
  assert.equal((await H.models.Interview.findById(fresh.id)).status, "in_progress");
  assert.equal((await H.models.Interview.findById(pending)).status, "expired");
  assert.ok(await H.models.InterviewReport.findOne({ interviewId: overdue.id }));
});

test("retention sweep deletes interviews/reports/events/questions/resumes past the configured period", async () => {
  await admin.put("/api/admin/settings").send({ retention: { interviewDays: 30, resumeDays: 10 } });
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH" });
  await c.post(`/api/interviews/${id}/abandon`).send({});
  const keep = await H.startInterview(c);
  const old = new Date(Date.now() - 40 * 86400_000);
  await backdate(id, old);
  await H.models.Resume.create({ userId: c.user.id, fileName: "x.pdf", aiConsentAt: new Date(), createdAt: new Date(Date.now() - 20 * 86400_000) });
  const out = await retentionSweep();
  assert.equal(out.interviews, 1);
  assert.equal(out.resumes, 1);
  const m = H.models;
  assert.equal(await m.Question.countDocuments({ interviewId: id }), 0);
  assert.equal(await m.SecurityEvent.countDocuments({ interviewId: id }), 0);
  assert.equal(await m.InterviewReport.countDocuments({ interviewId: id }), 0);
  assert.equal((await m.Interview.findById(keep.id)).status, "in_progress"); // running one untouched
});
