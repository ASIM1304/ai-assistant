const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

/**
 * Immutable final report. `facts` holds values measured by the backend
 * (timings, counts, events). Everything else is an AI-assisted assessment and
 * is labelled as such (see `provenance`).
 */
const reportSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    overallScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: null },
    accuracyScore: { type: Number, default: null },
    communicationScore: { type: Number, default: null },
    problemSolvingScore: { type: Number, default: null },
    questionScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
    difficultyProgression: { type: [String], default: [] },
    interviewType: { type: String, default: "technical" },
    skillScores: { type: [mongoose.Schema.Types.Mixed], default: [] }, // per category, from evaluated answers only
    criteriaScores: { type: mongoose.Schema.Types.Mixed, default: {} }, // 7 criteria on 0-100
    practicePlan: { type: [mongoose.Schema.Types.Mixed], default: [] },
    practicePlanSource: { type: String, enum: ["ai", "rule_based", "none"], default: "none" },

    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    narrativeSource: { type: String, enum: ["ai", "rule_based", "none"], default: "none" },

    facts: { type: mongoose.Schema.Types.Mixed, default: {} },
    provenance: { type: mongoose.Schema.Types.Mixed, default: {} },
    disclaimer: String,
    legacy: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonOpts },
);

module.exports = mongoose.model("InterviewReport", reportSchema);
