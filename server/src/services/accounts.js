const { User, Session, AuthToken, Resume, Interview, Question, SecurityEvent, InterviewReport } = require("../models");

/** Permanently removes a user and everything derived from them. */
async function deleteUserCascade(userId) {
  const interviews = await Interview.find({ userId }).select("_id").lean();
  const ids = interviews.map((i) => i._id);
  await Promise.all([
    Question.deleteMany({ interviewId: { $in: ids } }),
    SecurityEvent.deleteMany({ interviewId: { $in: ids } }),
    InterviewReport.deleteMany({ interviewId: { $in: ids } }),
  ]);
  await Promise.all([
    Interview.deleteMany({ userId }),
    Resume.deleteMany({ userId }),
    Session.deleteMany({ userId }),
    AuthToken.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
}

/** Everything we hold about the user, for the "download my data" request. */
async function exportUserData(user) {
  const [interviews, resume] = await Promise.all([Interview.find({ userId: user._id }).sort({ createdAt: 1 }).lean(), Resume.findOne({ userId: user._id }).lean()]);
  const ids = interviews.map((i) => i._id);
  const [questions, events, reports] = await Promise.all([
    Question.find({ interviewId: { $in: ids } }).sort({ questionNumber: 1 }).lean(),
    SecurityEvent.find({ interviewId: { $in: ids } }).sort({ timestamp: 1 }).lean(),
    InterviewReport.find({ interviewId: { $in: ids } }).lean(),
  ]);
  const strip = (o) => {
    const { __v, ...rest } = o;
    return rest;
  };
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, profile: user.profile },
    resume: resume ? { fileName: resume.fileName, analysis: resume.analysis, uploadedAt: resume.createdAt } : null,
    interviews: interviews.map((i) => ({
      ...strip(i),
      questions: questions.filter((q) => q.interviewId.equals(i._id)).map(strip),
      securityEvents: events.filter((e) => e.interviewId.equals(i._id)).map(strip),
      report: reports.map(strip).find((r) => r.interviewId.equals(i._id)) || null,
    })),
  };
}

module.exports = { deleteUserCascade, exportUserData };
