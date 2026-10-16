const { User, Interview, Question, SecurityEvent, InterviewReport, JobRole, QuestionCategory, AuditLog } = require("../models");
const { getSettings, updateSettings } = require("../services/settings");
const engine = require("../services/interviewEngine");
const { ensureReport } = require("../services/reportService");
const { historyItem } = require("../services/serializers");
const { deleteUserCascade } = require("../services/accounts");
const { revokeAllSessions } = require("../middleware/auth");
const { audit } = require("../services/audit");
const { maskEmail, slugify, stripTags } = require("../utils/text");
const { badRequest, conflict, notFound } = require("../utils/AppError");

const PAGE = 25;
const page = (q) => Math.max(1, Number(q.page) || 1);

// Privacy by design: admins get name + masked e-mail. Phone, education, skills,
// experience and resume are never returned by any admin endpoint.
const candidateView = (u, extra = {}) => ({ id: u.id, name: u.name, emailMasked: maskEmail(u.email), isActive: u.isActive, emailVerified: u.emailVerified, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, ...extra });

async function stats(_req, res) {
  const [candidates, pendingReview, inProgress, completed] = await Promise.all([
    User.countDocuments({ role: "candidate" }),
    Interview.countDocuments({ reviewStatus: "pending" }),
    Interview.countDocuments({ status: "in_progress" }),
    Interview.countDocuments({ status: "completed" }),
  ]);
  res.json({ candidates, pendingReview, inProgress, completed });
}

async function listCandidates(req, res) {
  const { search } = req.valid.query;
  const filter = { role: "candidate" };
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page(req.valid.query) - 1) * PAGE).limit(PAGE),
    User.countDocuments(filter),
  ]);
  const counts = await Interview.aggregate([{ $match: { userId: { $in: users.map((u) => u._id) } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({ total, candidates: users.map((u) => candidateView(u, { interviewCount: byId[u.id] || 0 })) });
}

async function setCandidateActive(req, res) {
  const user = await User.findOne({ _id: req.valid.params.id, role: "candidate" });
  if (!user) throw notFound("Candidate not found");
  user.isActive = req.valid.body.isActive;
  await user.save();
  if (!user.isActive) await revokeAllSessions(user._id);
  await audit(req.user, user.isActive ? "admin.candidate.enable" : "admin.candidate.disable", { type: "user", id: user.id });
  res.json({ candidate: candidateView(user) });
}

async function deleteCandidate(req, res) {
  const user = await User.findOne({ _id: req.valid.params.id, role: "candidate" });
  if (!user) throw notFound("Candidate not found");
  await deleteUserCascade(user._id);
  await audit(req.user, "admin.candidate.delete", { type: "user", id: user.id });
  res.json({ ok: true });
}

async function listInterviews(req, res) {
  const { status, flagged } = req.valid.query;
  const filter = { startedAt: { $exists: true } };
  if (status) filter.status = status;
  if (flagged) filter.flaggedForReview = true;
  const [items, total] = await Promise.all([
    Interview.find(filter).sort({ createdAt: -1 }).skip((page(req.valid.query) - 1) * PAGE).limit(PAGE),
    Interview.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: items.map((i) => i.userId) } }).select("name email");
  const u = Object.fromEntries(users.map((x) => [x.id, x]));
  res.json({
    total,
    interviews: items.map((i) => ({
      id: i.id,
      candidate: u[String(i.userId)] ? { id: String(i.userId), name: u[String(i.userId)].name, emailMasked: maskEmail(u[String(i.userId)].email) } : null,
      domain: i.domain,
      status: i.status,
      score: i.score,
      durationSeconds: i.durationSeconds,
      warningCount: i.warningCount,
      flaggedForReview: i.flaggedForReview,
      reviewStatus: i.reviewStatus,
      startedAt: i.startedAt,
    })),
  });
}

async function interviewDetail(req, res) {
  const interview = await Interview.findById(req.valid.params.id);
  if (!interview) throw notFound("Interview not found");
  const [user, questions, events] = await Promise.all([
    User.findById(interview.userId).select("name email"),
    Question.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean(),
    SecurityEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 }).lean(),
  ]);
  const report = (await InterviewReport.findOne({ interviewId: interview._id })) || (["completed", "terminated", "expired", "abandoned"].includes(interview.status) ? await ensureReport(interview) : null);
  await audit(req.user, "admin.interview.view", { type: "interview", id: interview.id }); // every access is logged
  res.json({
    interview: {
      id: interview.id,
      domain: interview.domain,
      status: interview.status,
      endReason: interview.endReason,
      startedAt: interview.startedAt,
      completedAt: interview.completedAt,
      durationSeconds: interview.durationSeconds,
      consent: interview.consent,
      verification: interview.verification,
      flaggedForReview: interview.flaggedForReview,
      reviewStatus: interview.reviewStatus,
      reviewNotes: interview.reviewNotes,
      warningCount: interview.warningCount,
    },
    candidate: user ? { id: user.id, name: user.name, emailMasked: maskEmail(user.email) } : null,
    report: report ? report.toJSON() : null,
    questions: questions.map((q) => ({ ...historyItem(q, { reveal: true }), promptInjectionSuspected: q.promptInjectionSuspected })),
    securityEvents: events.map((e) => ({ id: e._id.toString(), eventType: e.eventType, timestamp: e.timestamp, durationSeconds: e.durationSeconds, severity: e.severity, description: e.description, countsTowardLimit: e.countsTowardLimit, source: e.source })),
  });
}

async function reviewInterview(req, res) {
  const interview = await Interview.findById(req.valid.params.id);
  if (!interview) throw notFound("Interview not found");
  if (["scheduled", "ready", "in_progress"].includes(interview.status)) throw conflict("Interview has not finished yet.", "INVALID_STATE");
  interview.reviewStatus = req.valid.body.decision;
  interview.reviewNotes = stripTags(req.valid.body.notes || "", 1000);
  interview.reviewedBy = req.user._id;
  interview.reviewedAt = new Date();
  await interview.save();
  await audit(req.user, "admin.interview.review", { type: "interview", id: interview.id }, { decision: interview.reviewStatus });
  res.json({ interview: { id: interview.id, reviewStatus: interview.reviewStatus } });
}

async function scheduleInterview(req, res) {
  const { candidateId, jobRole, scheduledFor } = req.valid.body;
  const user = await User.findOne({ _id: candidateId, role: "candidate", isActive: true });
  if (!user) throw notFound("Candidate not found");
  const interview = await engine.createInterview(user, jobRole, { scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined, scheduledBy: req.user._id });
  await audit(req.user, "admin.interview.schedule", { type: "interview", id: interview.id });
  res.status(201).json({ interview: { id: interview.id, status: interview.status, domain: interview.domain } });
}

// ── roles / categories ──────────────────────────────────────────────────────
const listRoles = async (_req, res) => res.json({ roles: await JobRole.find().sort({ sortOrder: 1, label: 1 }) });

async function createRole(req, res) {
  const b = req.valid.body;
  const key = slugify(b.label);
  if (await JobRole.findOne({ key })) throw conflict("A role with that name already exists", "DUPLICATE");
  const role = await JobRole.create({ key, label: stripTags(b.label, 80), description: stripTags(b.description || "", 300), categories: b.categories || [], active: b.active ?? true, sortOrder: b.sortOrder ?? 100 });
  await audit(req.user, "admin.role.create", { type: "jobRole", id: role.id });
  res.status(201).json({ role });
}

async function updateRole(req, res) {
  const b = req.valid.body;
  const set = {};
  if (b.label !== undefined) set.label = stripTags(b.label, 80);
  if (b.description !== undefined) set.description = stripTags(b.description, 300);
  if (b.categories !== undefined) set.categories = b.categories.map((c) => stripTags(c, 60));
  if (b.active !== undefined) set.active = b.active;
  if (b.sortOrder !== undefined) set.sortOrder = b.sortOrder;
  const role = await JobRole.findByIdAndUpdate(req.valid.params.id, { $set: set }, { new: true });
  if (!role) throw notFound("Role not found");
  await audit(req.user, "admin.role.update", { type: "jobRole", id: role.id });
  res.json({ role });
}

async function deleteRole(req, res) {
  const role = await JobRole.findById(req.valid.params.id);
  if (!role) throw notFound("Role not found");
  if (await Interview.exists({ jobRole: role.key })) throw conflict("This role has interviews. Deactivate it instead of deleting.", "IN_USE");
  await role.deleteOne();
  await audit(req.user, "admin.role.delete", { type: "jobRole", id: role.id });
  res.json({ ok: true });
}

const listCategories = async (_req, res) => res.json({ categories: await QuestionCategory.find().sort({ name: 1 }) });

async function createCategory(req, res) {
  const name = stripTags(req.valid.body.name, 60);
  if (await QuestionCategory.findOne({ name })) throw conflict("Category already exists", "DUPLICATE");
  const category = await QuestionCategory.create({ name, description: stripTags(req.valid.body.description || "", 300), active: req.valid.body.active ?? true });
  await audit(req.user, "admin.category.create", { type: "category", id: category.id });
  res.status(201).json({ category });
}

async function updateCategory(req, res) {
  const b = req.valid.body;
  const set = {};
  if (b.name !== undefined) set.name = stripTags(b.name, 60);
  if (b.description !== undefined) set.description = stripTags(b.description, 300);
  if (b.active !== undefined) set.active = b.active;
  const category = await QuestionCategory.findByIdAndUpdate(req.valid.params.id, { $set: set }, { new: true });
  if (!category) throw notFound("Category not found");
  await audit(req.user, "admin.category.update", { type: "category", id: category.id });
  res.json({ category });
}

// ── settings / activity ─────────────────────────────────────────────────────
const getSettingsHandler = async (_req, res) => res.json({ settings: await getSettings({ fresh: true }) });

async function putSettings(req, res) {
  const current = await getSettings({ fresh: true });
  const { deepMerge } = require("../services/settings");
  const merged = deepMerge(current, req.valid.body);
  const order = ["easy", "medium", "hard"];
  if (order.indexOf(merged.interview.minDifficulty) > order.indexOf(merged.interview.maxDifficulty)) throw badRequest("minDifficulty cannot be above maxDifficulty", "INVALID_SETTINGS");
  const w = merged.proctoring.warningLimits;
  if (w.terminateAt > 0 && w.terminateAt < w.reviewAt) throw badRequest("terminateAt must be 0 (disabled) or >= reviewAt", "INVALID_SETTINGS");
  const settings = await updateSettings(req.valid.body);
  await audit(req.user, "admin.settings.update", { type: "settings" }, { keys: Object.keys(req.valid.body) });
  res.json({ settings });
}

async function activity(req, res) {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(Math.min(200, Number(req.query.limit) || 50));
  res.json({ activity: logs.map((l) => ({ id: l.id, at: l.createdAt, action: l.action, actorRole: l.actorRole, targetType: l.targetType, targetId: l.targetId })) });
}

module.exports = { stats, listCandidates, setCandidateActive, deleteCandidate, listInterviews, interviewDetail, reviewInterview, scheduleInterview, listRoles, createRole, updateRole, deleteRole, listCategories, createCategory, updateCategory, getSettings: getSettingsHandler, putSettings, activity };
