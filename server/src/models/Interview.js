const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const STATUSES = ["scheduled", "ready", "in_progress", "completed", "terminated", "abandoned", "expired"];
const TERMINAL = ["completed", "terminated", "abandoned", "expired"];

const interviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobRole: { type: String, required: true }, // JobRole.key
    domain: { type: String, required: true }, // JobRole.label snapshot (shown in UI/history)
    interviewType: { type: String, enum: ["technical", "behavioral", "hr", "resume", "job_description"], default: "technical" },
    jobDescription: { type: String, maxlength: 6000 }, // supplied by the candidate; untrusted text
    status: { type: String, enum: STATUSES, default: "scheduled" },

    scheduledFor: Date,
    scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Snapshot of admin settings at creation, so rules can't change mid-interview
    // and the frontend never supplies them.
    config: { type: mongoose.Schema.Types.Mixed, required: true },

    consent: {
      privacyVersion: String,
      acceptedAt: Date,
      cameraConsent: Boolean,
      microphoneConsent: Boolean,
      identityConfirmed: Boolean,
    },
    verification: { faceDetected: Boolean, voiceChecked: Boolean, at: Date },

    startedAt: Date,
    deadlineAt: Date,
    completedAt: Date,
    durationSeconds: { type: Number, default: 0 },
    endReason: String,

    questionsAsked: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    questionsSkipped: { type: Number, default: 0 },
    currentDifficulty: { type: String, enum: ["easy", "medium", "hard"], default: "easy" },
    score: { type: Number, default: null }, // set by the backend when the report is built

    lastHeartbeatAt: Date,
    lastActivityAt: Date,

    // Proctoring summary (events themselves live in SecurityEvent)
    warningCount: { type: Number, default: 0 },
    flaggedForReview: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: ["none", "pending", "cleared", "concern_confirmed"], default: "none" },
    reviewNotes: { type: String, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,

    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewReport" },
    candidateContext: { type: mongoose.Schema.Types.Mixed, default: null }, // skills/level snapshot used for prompts
  },
  { timestamps: true, toJSON: jsonOpts },
);

interviewSchema.index({ userId: 1, createdAt: -1 });
interviewSchema.index({ userId: 1, status: 1 });
interviewSchema.index({ status: 1, deadlineAt: 1 });
interviewSchema.index({ flaggedForReview: 1, reviewStatus: 1, createdAt: -1 });

const Interview = mongoose.model("Interview", interviewSchema);
Interview.STATUSES = STATUSES;
Interview.TERMINAL = TERMINAL;
module.exports = Interview;
