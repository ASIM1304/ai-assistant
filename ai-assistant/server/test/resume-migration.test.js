const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers");
const { migrate } = require("../scripts/migrate-legacy");

let app;
before(async () => {
  await H.setupDb("resume");
  app = H.createApp();
});
after(H.teardownDb);

const RESUME = "Jane Developer. Senior JavaScript engineer with eight years of experience building React and Node.js applications, REST APIs, CI pipelines, and mentoring teams. ".repeat(2);
const upload = (c, buf, { name = "resume.txt", type = "text/plain", consent = true } = {}) => {
  const t = c.post("/api/resume/analyze").attach("resume", buf, { filename: name, contentType: type });
  if (consent !== null) t.field("aiConsent", String(consent));
  return t;
};

function tinyPdf(text) {
  const stream = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(pdf);
}

test("resume: requires login, CSRF and explicit AI-processing consent", async () => {
  assert.equal((await H.request(app).post("/api/resume/analyze").attach("resume", Buffer.from(RESUME), "r.txt")).status, 401);
  const c = await H.registerCandidate(app);
  const noCsrf = await c.agent.post("/api/resume/analyze").attach("resume", Buffer.from(RESUME), "r.txt").field("aiConsent", "true");
  assert.equal(noCsrf.status, 403);
  const noConsent = await upload(c, Buffer.from(RESUME), { consent: null });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.body.error.code, "CONSENT_REQUIRED");
  assert.equal((await upload(c, Buffer.from(RESUME), { consent: false })).status, 400);
});

test("resume: text and PDF are analysed; result validated, domains filtered; file itself isn't stored", async () => {
  const c = await H.registerCandidate(app);
  const t = await upload(c, Buffer.from(RESUME));
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.aiGenerated, true);
  assert.equal(t.body.analysis.experienceLevel, "Mid");
  assert.deepEqual(t.body.analysis.recommendedDomains.map((d) => d.label), ["React"]); // invented domain dropped
  const p = await upload(c, tinyPdf(RESUME), { name: "cv.pdf", type: "application/pdf" });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const doc = await H.models.Resume.find({ userId: c.user.id }).lean();
  assert.equal(doc.length, 1); // one active resume per user (replaced)
  assert.ok(!JSON.stringify(doc[0]).includes("Jane Developer")); // raw text not retained
  assert.equal((await c.get("/api/resume")).body.resume.fileName, "cv.pdf");
  assert.equal((await c.delete("/api/resume")).status, 200);
  assert.equal((await c.get("/api/resume")).body.resume, null);
});

test("resume: type is judged by content, not by the declared MIME type or extension", async () => {
  const c = await H.registerCandidate(app);
  const fakePdf = await upload(c, Buffer.from("MZ\x90\x00\x03\x00\x00\x00 this is an executable \x00\x00"), { name: "cv.pdf", type: "application/pdf" });
  assert.equal(fakePdf.status, 400);
  const docx = await upload(c, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), { name: "cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  assert.equal(docx.status, 400);
  assert.match(docx.body.error.message, /PDF/);
  const brokenPdf = await upload(c, Buffer.from("%PDF-1.4 garbage garbage garbage"), { name: "cv.pdf", type: "application/pdf" });
  assert.equal(brokenPdf.status, 400);
  const tiny = await upload(c, Buffer.from("too short"));
  assert.equal(tiny.status, 400);
  const huge = await upload(c, Buffer.alloc(5 * 1024 * 1024 + 10, "a"));
  assert.equal(huge.status, 413);
});

test("resume: AI outage returns a retryable 503 and stores nothing", async () => {
  const c = await H.registerCandidate(app);
  H.ai._setChat(async () => {
    throw new Error("provider down");
  });
  try {
    const r = await upload(c, Buffer.from(RESUME));
    assert.equal(r.status, 503);
    assert.equal(r.body.error.retryable, true);
    assert.equal(await H.models.Resume.countDocuments({ userId: c.user.id }), 0);
  } finally {
    H.ai._setChat(H.fakeChat);
  }
});

test("legacy migration converts users and interviews, invents no scores, and is idempotent", async () => {
  const db = H.mongoose.connection.db;
  const bcrypt = require("bcryptjs");
  const uid = new H.mongoose.Types.ObjectId();
  const iid = new H.mongoose.Types.ObjectId();
  await db.collection("users").insertOne({ _id: uid, name: "Old User", email: "old@example.com", password: await bcrypt.hash("oldpass123", 4), createdAt: new Date() });
  await db.collection("interviews").insertOne({
    _id: iid, userId: uid, domain: "React", score: 72, duration: 12, questionsAnswered: 2, isComplete: true, terminated: false, createdAt: new Date(Date.now() - 86400_000),
    messages: [
      { role: "ai", content: "What is JSX?", timestamp: new Date() }, { role: "user", content: "A syntax extension", evaluation: "correct", timestamp: new Date() }, { role: "ai", content: "Nice answer." },
      { role: "ai", content: "Explain hooks.", timestamp: new Date() }, { role: "user", content: "idk", evaluation: "incorrect", timestamp: new Date() }, { role: "ai", content: "Review hooks." },
    ],
    warnings: [{ type: "tab_hidden", message: "Tab hidden", timestamp: new Date() }, { type: "no_face", message: "No face", timestamp: new Date() }],
  });
  const first = await migrate(db, () => {});
  assert.deepEqual(first, { users: 1, interviews: 1 });
  const again = await migrate(db, () => {});
  assert.deepEqual(again, { users: 0, interviews: 0 });

  // the old password still works through the new login
  const login = await H.request(app).post("/api/auth/login").send({ email: "old@example.com", password: "oldpass123" });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "candidate");

  const it = await H.models.Interview.findById(iid).lean();
  assert.equal(it.status, "completed");
  assert.equal(it.score, 72);
  assert.equal(it.durationSeconds, 720);
  assert.equal(it.messages, undefined);
  const qs = await H.models.Question.find({ interviewId: iid }).sort({ questionNumber: 1 }).lean();
  assert.deepEqual(qs.map((q) => [q.question, q.answer, q.evaluation.verdict, q.feedback]), [["What is JSX?", "A syntax extension", "correct", "Nice answer."], ["Explain hooks.", "idk", "incorrect", "Review hooks."]]);
  assert.equal(qs[0].evaluation.score, undefined); // no fabricated criterion scores
  const ev = await H.models.SecurityEvent.find({ interviewId: iid }).lean();
  assert.deepEqual(ev.map((e) => e.eventType).sort(), ["FACE_NOT_DETECTED", "TAB_SWITCH"]);
  const hist = await login.body && (await H.request(app).get("/api/interviews").set("Cookie", login.headers["set-cookie"]));
  assert.equal(hist.body.interviews[0].topic, "React");
  assert.equal(hist.body.interviews[0].score, 72);
  const rep = await H.models.InterviewReport.findOne({ interviewId: iid }).lean();
  assert.equal(rep.legacy, true);
  assert.equal(rep.overallScore, 72);
});
