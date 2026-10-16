const { Interview, InterviewReport, SecurityEvent, Question, User } = require("../models");
const engine = require("../services/interviewEngine");
const { ensureReport } = require("../services/reportService");
const { historyItem, isTerminal } = require("../services/serializers");
const { notFound } = require("../utils/AppError");

const own = (req) => engine.loadOwned(req.user._id, req.valid.params.id);

async function create(req, res) {
  const { jobRole, ...opts } = req.valid.body;
  const interview = await engine.createInterview(req.user, jobRole, opts);
  res.status(201).json({ interview: { id: interview.id, interviewType: interview.interviewType, status: interview.status, domain: interview.domain, jobRole: interview.jobRole, totalQuestions: interview.config.totalQuestions, durationMinutes: interview.config.durationMinutes } });
}

async function consent(req, res) {
  const interview = await engine.recordConsent(await own(req), req.valid.body);
  res.json({ interview: { id: interview.id, status: interview.status } });
}

async function start(req, res) {
  const interview = await engine.startInterview(await own(req), req.valid.body.verification);
  res.json(await engine.buildState(interview));
}

const state = async (req, res) => res.json(await engine.buildState(await own(req)));

async function answer(req, res) {
  const out = await engine.submitAnswer(await own(req), req.valid.body);
  res.json(out);
}

async function skip(req, res) {
  res.json(await engine.skipQuestion(await own(req), req.valid.body));
}

async function event(req, res) {
  res.json(await engine.recordEvent(await own(req), req.valid.body));
}

async function heartbeat(req, res) {
  res.json(await engine.heartbeat(await own(req)));
}

async function abandon(req, res) {
  const interview = await own(req);
  if (isTerminal(interview.status)) return res.json(await engine.buildState(interview));
  const done = await engine.finalizeInterview(interview, "abandoned", "candidate_exit");
  res.json(await engine.buildState(done));
}

/** In-progress interview first (so a refresh resumes), else a pending one. */
async function active(req, res) {
  let i = await Interview.findOne({ userId: req.user._id, status: "in_progress" });
  if (i && (await engine.enforceTime(i))) i = null;
  if (!i) i = await Interview.findOne({ userId: req.user._id, status: { $in: ["ready", "scheduled"] } }).sort({ createdAt: -1 });
  res.json({ interview: i ? { id: i.id, status: i.status, domain: i.domain, jobRole: i.jobRole, scheduledFor: i.scheduledFor || null } : null });
}

// History list: same shape the dashboard already used, plus status/report info.
async function list(req, res) {
  const items = await Interview.find({ userId: req.user._id, status: { $in: ["completed", "terminated", "expired", "abandoned"] }, startedAt: { $exists: true } })
    .select("domain interviewType score durationSeconds createdAt warningCount status questionsAnswered reportId")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({
    interviews: items.map((i) => ({
      id: i.id,
      topic: i.domain,
      interviewType: i.interviewType,
      score: i.score ?? 0,
      duration: Math.max(1, Math.round(i.durationSeconds / 60)),
      durationSeconds: i.durationSeconds,
      date: i.createdAt,
      warningCount: i.warningCount,
      terminated: i.status === "terminated",
      status: i.status,
      questionsAnswered: i.questionsAnswered,
    })),
  });
}

async function report(req, res) {
  const interview = await own(req);
  if (!isTerminal(interview.status) || !interview.startedAt) throw notFound("Report not available yet", "REPORT_NOT_READY");
  const rep = (await InterviewReport.findOne({ interviewId: interview._id })) || (await ensureReport(interview));
  if (!rep) throw notFound("Report not available", "REPORT_NOT_READY");
  const [questions, events, user] = await Promise.all([
    Question.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean(),
    SecurityEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 }).lean(),
    User.findById(interview.userId).select("name"),
  ]);
  res.json({
    report: rep.toJSON(),
    candidate: { name: user?.name },
    interview: { id: interview.id, domain: interview.domain, status: interview.status, startedAt: interview.startedAt, completedAt: interview.completedAt, durationSeconds: interview.durationSeconds },
    questions: questions.map((q) => historyItem(q, { reveal: true })),
    securityEvents: events.map((e) => ({ eventType: e.eventType, timestamp: e.timestamp, durationSeconds: e.durationSeconds, severity: e.severity, description: e.description })),
  });
}

module.exports = { create, consent, start, state, answer, skip, event, heartbeat, abandon, active, list, report };

/** Performance trends for the candidate dashboard - computed only from the candidate's own reports. */
async function trends(req, res) {
  const reports = await InterviewReport.find({ userId: req.user._id }).sort({ createdAt: 1 }).limit(100).lean();
  const points = reports.map((r) => ({ interviewId: r.interviewId.toString(), date: r.createdAt, score: r.overallScore, role: r.facts?.jobRole, interviewType: r.interviewType || r.facts?.interviewType || "technical", status: r.facts?.endStatus, legacy: !!r.legacy, evaluated: r.facts?.counts?.evaluated ?? null }));

  const real = reports.filter((r) => !r.legacy && r.facts?.counts?.evaluated > 0);
  const critSum = {};
  const catSum = {};
  for (const r of real) {
    for (const [k, v] of Object.entries(r.criteriaScores || {})) if (v !== null && v !== undefined) (critSum[k] ||= []).push(v);
    for (const c of r.skillScores || []) {
      const e = (catSum[c.category] ||= { sum: 0, n: 0 });
      e.sum += c.average * c.questions;
      e.n += c.questions;
    }
  }
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const scores = points.filter((p) => !p.legacy || p.score).map((p) => p.score);
  const lastPlan = [...reports].reverse().find((r) => r.practicePlan?.length);
  res.json({
    points,
    criteria: Object.fromEntries(Object.entries(critSum).map(([k, v]) => [k, avg(v)])),
    categories: Object.entries(catSum).map(([category, e]) => ({ category, average: Math.round(e.sum / e.n), questions: e.n })).sort((a, b) => b.average - a.average),
    summary: { interviews: points.length, average: scores.length ? avg(scores) : null, best: scores.length ? Math.max(...scores) : null, latest: scores.length ? scores[scores.length - 1] : null, change: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null },
    practicePlan: lastPlan ? { interviewId: lastPlan.interviewId.toString(), date: lastPlan.createdAt, source: lastPlan.practicePlanSource, items: lastPlan.practicePlan } : null,
    note: "Based on AI-assisted assessments; legacy imports and interviews with no evaluated answers are excluded from skill averages.",
  });
}
module.exports.trends = trends;
