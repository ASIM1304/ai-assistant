const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers");

let app, admin;
before(async () => {
  await H.setupDb("proctor");
  app = H.createApp();
  admin = await H.createAdmin(app);
});
after(H.teardownDb);
beforeEach(async () => {
  H.fake.reset();
  await admin.put("/api/admin/settings").send({ interview: { totalQuestions: 4, codingQuestionNumbers: [] }, proctoring: { minTabSwitchSeconds: 0, warningLimits: { notifyUntil: 2, reviewAt: 3, terminateAt: 5 }, events: { TAB_SWITCH: { enabled: true, severity: "warning", countsTowardLimit: true }, FACE_NOT_DETECTED: { enabled: true, countsTowardLimit: true } } } });
});

// Distinct types avoid the 2-second duplicate coalescing.
const TYPES = ["TAB_SWITCH", "FACE_NOT_DETECTED", "MULTIPLE_FACES", "CAMERA_DISABLED", "MICROPHONE_DISABLED", "FULLSCREEN_EXIT"];

test("events are stored with server timestamp, policy severity and description; warning ladder works", async () => {
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  const levels = [];
  for (let i = 0; i < 3; i++) {
    const r = await c.post(`/api/interviews/${id}/events`).send({ eventType: TYPES[i], durationSeconds: 8, clientTimestamp: "2001-01-01T00:00:00.000Z" });
    assert.equal(r.status, 200);
    levels.push(r.body.level);
    assert.equal(r.body.warningCount, i + 1);
  }
  assert.deepEqual(levels, ["notify", "notify", "review"]); // warnings 1,2 notify; 3 -> admin review
  const events = await H.models.SecurityEvent.find({ interviewId: id }).sort({ timestamp: 1 }).lean();
  assert.equal(events.length, 3);
  const e = events[0];
  assert.equal(e.eventType, "TAB_SWITCH");
  assert.equal(e.durationSeconds, 8);
  assert.equal(e.severity, "warning");
  assert.ok(Date.now() - e.timestamp.getTime() < 10_000); // server clock, not the client's 2001 value
  assert.match(e.description, /hidden|switched/i);
  assert.equal(events[2].severity, "critical"); // MULTIPLE_FACES per policy
  const it = await H.models.Interview.findById(id).lean();
  assert.equal(it.flaggedForReview, true);
  assert.equal(it.reviewStatus, "pending");
  assert.equal(it.status, "in_progress"); // a review flag does not end the interview
});

test("default policy ends the interview at the configured limit and marks it for review (not 'cheating')", async () => {
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  let last;
  for (let i = 0; i < 5; i++) last = await c.post(`/api/interviews/${id}/events`).send({ eventType: TYPES[i] });
  assert.equal(last.body.terminated, true);
  assert.equal(last.body.level, "terminate");
  const it = await H.models.Interview.findById(id).lean();
  assert.equal(it.status, "terminated");
  assert.equal(it.endReason, "proctoring_limit");
  assert.equal(it.reviewStatus, "pending");
  const rep = (await c.get(`/api/interviews/${id}/report`)).body;
  assert.equal(rep.report.facts.security.total, 5);
  assert.match(rep.report.facts.security.note, /not proof of misconduct/);
  assert.equal(rep.securityEvents.length, 5);
  // no more events once finished
  assert.equal((await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH" })).status, 409);
});

test("termination can be disabled by configuration (terminateAt = 0)", async () => {
  await admin.put("/api/admin/settings").send({ proctoring: { warningLimits: { terminateAt: 0 } } });
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  for (let i = 0; i < 6; i++) await c.post(`/api/interviews/${id}/events`).send({ eventType: TYPES[i] });
  assert.equal((await H.models.Interview.findById(id)).status, "in_progress");
});

test("brief tab switches below the configured threshold and disabled event types aren't counted", async () => {
  await admin.put("/api/admin/settings").send({ proctoring: { minTabSwitchSeconds: 3, events: { FULLSCREEN_EXIT: { enabled: false } } } });
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  const brief = await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH", durationSeconds: 1 });
  assert.equal(brief.body.warningCount, 0);
  assert.equal(brief.body.level, "none");
  const off = await c.post(`/api/interviews/${id}/events`).send({ eventType: "FULLSCREEN_EXIT" });
  assert.equal(off.body.recorded, false);
  const long = await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH", durationSeconds: 9 });
  // duplicate within 2s is coalesced, so wait it out via direct timestamp shift
  assert.equal(long.body.recorded, false);
  await H.models.SecurityEvent.updateMany({ interviewId: id }, { $set: { timestamp: new Date(Date.now() - 10_000) } });
  const long2 = await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH", durationSeconds: 9 });
  assert.equal(long2.body.warningCount, 1);
});

test("event spam is coalesced and validated", async () => {
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  for (let i = 0; i < 5; i++) await c.post(`/api/interviews/${id}/events`).send({ eventType: "TAB_SWITCH" });
  assert.equal(await H.models.SecurityEvent.countDocuments({ interviewId: id }), 1);
  assert.equal((await c.post(`/api/interviews/${id}/events`).send({ eventType: "MADE_UP" })).status, 400);
  assert.equal((await c.post(`/api/interviews/${id}/events`).send({ eventType: "INACTIVITY", durationSeconds: -5 })).status, 400);
});

test("heartbeat gap is recorded server-side as an informational event, not a violation", async () => {
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  await H.models.Interview.updateOne({ _id: id }, { $set: { lastHeartbeatAt: new Date(Date.now() - 5 * 60_000) } });
  const hb = await c.post(`/api/interviews/${id}/heartbeat`).send({});
  assert.equal(hb.status, 200);
  assert.ok(hb.body.remainingSeconds > 0);
  const ev = await H.models.SecurityEvent.findOne({ interviewId: id, eventType: "CONNECTION_LOST" }).lean();
  assert.equal(ev.source, "server");
  assert.equal(ev.severity, "info");
  assert.equal(ev.countsTowardLimit, false);
  assert.ok(ev.durationSeconds >= 299);
  assert.equal((await H.models.Interview.findById(id)).warningCount, 0);
});

test("admin can review flagged interviews; decision and notes are stored and audited", async () => {
  const c = await H.registerCandidate(app);
  const { id } = await H.startInterview(c);
  for (let i = 0; i < 3; i++) await c.post(`/api/interviews/${id}/events`).send({ eventType: TYPES[i] });
  await c.post(`/api/interviews/${id}/abandon`).send({});
  const flagged = await admin.get("/api/admin/interviews?flagged=true");
  assert.ok(flagged.body.interviews.some((i) => i.id === id && i.reviewStatus === "pending"));
  const detail = await admin.get(`/api/admin/interviews/${id}`);
  assert.equal(detail.body.securityEvents.length, 3);
  const rev = await admin.post(`/api/admin/interviews/${id}/review`).send({ decision: "cleared", notes: "Lighting problem, confirmed with candidate." });
  assert.equal(rev.status, 200);
  const it = await H.models.Interview.findById(id).lean();
  assert.equal(it.reviewStatus, "cleared");
  assert.ok(it.reviewedBy && it.reviewedAt);
  const log = await admin.get("/api/admin/activity");
  assert.ok(log.body.activity.some((a) => a.action === "admin.interview.review" && a.targetId === id));
  assert.ok(log.body.activity.some((a) => a.action === "admin.interview.view" && a.targetId === id));
  // a candidate can't review
  assert.equal((await c.post(`/api/admin/interviews/${id}/review`).send({ decision: "cleared" })).status, 401);
});
