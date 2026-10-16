/**
 * Background maintenance: interview lifecycle + data retention.
 * Implemented in the app (not Mongo TTL indexes) because retention periods are
 * admin-configurable, and it works on any MongoDB-compatible server.
 */
const { Interview, Question, SecurityEvent, InterviewReport, Resume, Session, AuthToken, AuditLog, User } = require("../models");
const { getSettings } = require("./settings");
const { finalizeInterview } = require("./interviewEngine");

const DAY = 86_400_000;

/** Expire timed-out interviews, abandon silent ones, expire never-started ones. */
async function lifecycleSweep() {
  const s = await getSettings({ fresh: true });
  const now = Date.now();
  const out = { expired: 0, abandoned: 0, unstartedExpired: 0 };

  const overdue = await Interview.find({ status: "in_progress", deadlineAt: { $lt: new Date(now) } }).limit(50);
  for (const i of overdue) {
    await finalizeInterview(i, "expired", "time_limit");
    out.expired++;
  }

  const silentBefore = new Date(now - s.interview.abandonAfterMinutes * 60_000);
  const silent = await Interview.find({ status: "in_progress", lastActivityAt: { $lt: silentBefore }, lastHeartbeatAt: { $lt: silentBefore } }).limit(50);
  for (const i of silent) {
    await finalizeInterview(i, "abandoned", "no_activity");
    out.abandoned++;
  }

  const staleBefore = new Date(now - s.interview.unstartedExpireHours * 3600_000);
  const res = await Interview.updateMany(
    { status: { $in: ["scheduled", "ready"] }, createdAt: { $lt: staleBefore }, $or: [{ scheduledFor: { $exists: false } }, { scheduledFor: { $lt: staleBefore } }] },
    { $set: { status: "expired", endReason: "not_started", completedAt: new Date() } },
  );
  out.unstartedExpired = res.modifiedCount || 0;

  await Session.deleteMany({ expiresAt: { $lt: new Date(now) } });
  await AuthToken.deleteMany({ expiresAt: { $lt: new Date(now) } });
  return out;
}

/** Delete data past its retention period. */
async function retentionSweep() {
  const { retention } = await getSettings({ fresh: true });
  const now = Date.now();
  const cutoff = (days) => new Date(now - days * DAY);
  const out = {};

  const old = await Interview.find({ createdAt: { $lt: cutoff(retention.interviewDays) }, status: { $in: ["completed", "terminated", "abandoned", "expired"] } }).select("_id").lean();
  const ids = old.map((i) => i._id);
  if (ids.length) {
    await Promise.all([
      Question.deleteMany({ interviewId: { $in: ids } }),
      SecurityEvent.deleteMany({ interviewId: { $in: ids } }),
      InterviewReport.deleteMany({ interviewId: { $in: ids } }),
    ]);
    await Interview.deleteMany({ _id: { $in: ids } });
  }
  out.interviews = ids.length;
  out.resumes = (await Resume.deleteMany({ createdAt: { $lt: cutoff(retention.resumeDays) } })).deletedCount;
  out.auditLogs = (await AuditLog.deleteMany({ createdAt: { $lt: cutoff(retention.auditLogDays) } })).deletedCount;
  out.unverifiedAccounts = (await User.deleteMany({ emailVerified: false, role: "candidate", createdAt: { $lt: cutoff(retention.unverifiedAccountDays) }, lastLoginAt: { $exists: false } })).deletedCount;
  return out;
}

function startScheduler() {
  const run = (fn, name) => () => fn().catch((e) => console.error(`[maintenance] ${name} failed:`, e.message));
  const a = setInterval(run(lifecycleSweep, "lifecycle"), 5 * 60_000);
  const b = setInterval(run(retentionSweep, "retention"), 24 * 3600_000);
  a.unref();
  b.unref();
  setTimeout(run(retentionSweep, "retention"), 30_000).unref();
  return () => {
    clearInterval(a);
    clearInterval(b);
  };
}

module.exports = { lifecycleSweep, retentionSweep, startScheduler };
