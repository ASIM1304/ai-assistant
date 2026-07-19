const mongoose = require("mongoose");

const interviewReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
    },

    domain: {
      type: String,
      required: true,
    },

    company: {
      type: String,
      default: "",
    },

    jobRole: {
      type: String,
      default: "",
    },

    experienceLevel: {
      type: String,
      default: "Fresher",
    },

    resumeScore: {
      type: Number,
      default: 0,
    },

    interviewScore: {
      type: Number,
      default: 0,
    },

    technicalScore: {
      type: Number,
      default: 0,
    },

    communicationScore: {
      type: Number,
      default: 0,
    },

    confidenceScore: {
      type: Number,
      default: 0,
    },

    problemSolvingScore: {
      type: Number,
      default: 0,
    },

    detectedSkills: [
      {
        skill: String,
        score: Number,
      },
    ],

    strengths: [String],

    weaknesses: [String],

    missingSkills: [String],

    recommendedRoles: [String],

    recommendedCompanies: [String],

    learningResources: [String],

    hiringRecommendation: {
      type: String,
      default: "Consider",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "InterviewReport",
  interviewReportSchema
);