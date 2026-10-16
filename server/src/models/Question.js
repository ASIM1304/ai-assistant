const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const criteriaFields = Object.fromEntries(
  ["technicalKnowledge", "accuracy", "relevance", "problemSolving", "communication", "clarity", "completeness"].map((k) => [
    k,
    { type: Number, min: 0, max: 10 },
  ]),
);

const questionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    questionNumber: { type: Number, required: true, min: 1 },
    question: { type: String, required: true, maxlength: 2000 },
    category: { type: String, default: "General", maxlength: 60 },
    questionType: { type: String, enum: ["behavioral", "coding"], default: "behavioral" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    source: { type: String, enum: ["ai", "fallback"], default: "ai" },
    isFollowUp: { type: Boolean, default: false },
    parentQuestionId: { type: mongoose.Schema.Types.ObjectId },

    status: { type: String, enum: ["asked", "evaluating", "answered", "skipped", "unanswered"], default: "asked" },
    answer: { type: String, maxlength: 10000 },
    shortAnswerWarned: { type: Boolean, default: false },
    promptInjectionSuspected: { type: Boolean, default: false },

    evaluation: {
      status: { type: String, enum: ["ok", "failed"] },
      criteria: criteriaFields,
      score: { type: Number, min: 0, max: 100 }, // computed by backend from criteria
      verdict: { type: String, enum: ["correct", "partial", "incorrect"] },
      confidence: Number,
      explanations: { type: mongoose.Schema.Types.Mixed }, // per-criterion reasoning from the model
      evidence: { type: [String], default: [] }, // quotes VERIFIED to occur in the answer
      evidenceRejected: { type: Number, default: 0 }, // quotes the model gave that were NOT in the answer
    },
    suggestions: { type: [String], default: [] },
    modelAnswer: { type: String, maxlength: 2500 },
    feedback: { type: String, maxlength: 1500 },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    evaluationAttempts: { type: Number, default: 0 },

    askedAt: { type: Date, default: Date.now },
    answeredAt: Date,
    timeSpentSeconds: Number,
  },
  { timestamps: true, toJSON: jsonOpts },
);

// Guarantees one question per number per interview, even under concurrent requests.
questionSchema.index({ interviewId: 1, questionNumber: 1 }, { unique: true });
questionSchema.index({ userId: 1 });

module.exports = mongoose.model("Question", questionSchema);
