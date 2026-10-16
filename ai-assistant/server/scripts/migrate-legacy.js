/**
 * One-time, idempotent migration from the v1 data model.
 *   users:      password -> passwordHash, adds role/isActive/emailVerified
 *   interviews: messages[]/warnings[] -> status + questions + securityEvents + report
 * Usage:  npm run migrate:legacy      (uses MONGO_URI)
 * Take a backup first (mongodump).
 */
const mongoose = require("mongoose");
const { Question, SecurityEvent, InterviewReport } = require("../src/models");
const { DEFAULT_SETTINGS } = require("../src/services/settings");
const { DISCLAIMER } = require("../src/services/reportService");

const WARNING_MAP = { camera_off: "CAMERA_DISABLED", tab_hidden: "TAB_SWITCH", no_face: "FACE_NOT_DETECTED", permission_denied: "PERMISSION_DENIED" };

/** Pairs legacy chat messages into question records. */
function extractQuestions(messages = []) {
  const out = [];
  let q = null;
  let expecting = "question";
  for (const m of messages) {
    if (m.role === "ai" && expecting === "question") {
      q = { question: m.content, questionType: m.questionType || "behavioral", askedAt: m.timestamp };
      out.push(q);
      expecting = "answer";
    } else if (m.role === "user" && expecting === "answer") {
      q.answer = m.content;
      q.verdict = m.evaluation || undefined;
      q.answeredAt = m.timestamp;
      expecting = "feedback";
    } else if (m.role === "ai" && expecting === "feedback") {
      q.feedback = m.content;
      expecting = "question";
    }
  }
  return out;
}

async function migrate(db = mongoose.connection.db, log = console.log) {
  const result = { users: 0, interviews: 0 };

  const users = await db.collection("users").updateMany(
    { password: { $exists: true }, passwordHash: { $exists: false } },
    { $rename: { password: "passwordHash" }, $set: { role: "candidate", isActive: true, emailVerified: true, failedLoginAttempts: 0 } },
  );
  result.users = users.modifiedCount;

  const legacy = await db.collection("interviews").find({ status: { $exists: false } }).toArray();
  for (const old of legacy) {
    const status = old.terminated ? "terminated" : old.isComplete ? "completed" : "abandoned";
    const questions = extractQuestions(old.messages);
    const startedAt = old.createdAt || new Date();
    const durationSeconds = Math.round((old.duration || 0) * 60);
    const completedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    await db.collection("interviews").updateOne(
      { _id: old._id },
      {
        $set: {
          jobRole: String(old.domain || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          status,
          config: { ...DEFAULT_SETTINGS.interview, categories: ["General"], proctoring: DEFAULT_SETTINGS.proctoring },
          startedAt,
          completedAt,
          durationSeconds,
          endReason: "legacy_import",
          questionsAsked: questions.length,
          questionsAnswered: questions.filter((x) => x.answer).length,
          questionsSkipped: 0,
          currentDifficulty: "medium",
          warningCount: (old.warnings || []).length,
          flaggedForReview: false,
          reviewStatus: "none",
          score: old.score ?? 0,
          updatedAt: new Date(),
        },
        $unset: { messages: "", warnings: "", isComplete: "", terminated: "", duration: "", feedback: "", cameraEnabled: "" },
      },
    );

    if (questions.length) {
      await Question.insertMany(
        questions.map((x, i) => ({
          interviewId: old._id,
          userId: old.userId,
          questionNumber: i + 1,
          question: String(x.question).slice(0, 2000),
          category: "General",
          questionType: x.questionType,
          difficulty: "medium", // not recorded in v1
          source: "ai",
          status: x.answer ? "answered" : "unanswered",
          answer: x.answer ? String(x.answer).slice(0, 10000) : undefined,
          // v1 only stored correct/partial/incorrect - no criterion scores, so none are invented.
          evaluation: x.verdict ? { verdict: x.verdict } : undefined,
          feedback: x.feedback ? String(x.feedback).slice(0, 1500) : undefined,
          askedAt: x.askedAt,
          answeredAt: x.answeredAt,
        })),
        { ordered: false },
      );
    }
    if ((old.warnings || []).length) {
      await SecurityEvent.insertMany(
        old.warnings.map((w) => ({
          interviewId: old._id,
          userId: old.userId,
          eventType: WARNING_MAP[w.type] || "TAB_SWITCH",
          timestamp: w.timestamp,
          severity: "warning",
          description: String(w.message || "").slice(0, 300),
          countsTowardLimit: true,
          source: "client",
        })),
      );
    }
    const report = await InterviewReport.create({
      interviewId: old._id,
      userId: old.userId,
      overallScore: old.score ?? 0,
      questionScores: [],
      summary: "Imported from an earlier version of the platform. Detailed criterion scores were not recorded then.",
      narrativeSource: "none",
      legacy: true,
      facts: { jobRole: old.domain, startedAt, completedAt, durationSeconds, endStatus: status, counts: { asked: questions.length }, security: { total: (old.warnings || []).length } },
      provenance: { scores: "Overall score as recorded by the earlier version (single AI-assigned value)." },
      disclaimer: DISCLAIMER,
    });
    await db.collection("interviews").updateOne({ _id: old._id }, { $set: { reportId: report._id } });
    result.interviews++;
  }
  log(`Migrated ${result.users} user(s) and ${result.interviews} interview(s).`);
  return result;
}

module.exports = { migrate, extractQuestions };

if (require.main === module) {
  const { config } = require("../src/config/env");
  mongoose
    .connect(config.mongoUri)
    .then(() => migrate())
    .then(() => mongoose.disconnect())
    .catch((e) => {
      console.error("Migration failed:", e.message);
      process.exit(1);
    });
}
