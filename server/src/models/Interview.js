const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["ai", "user"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const InterviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Resume Information
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Resume",
    default: null,
  },

  domain: {
    type: String,
    required: true,
  },

  company: {
    type: String,
    default: "General",
  },

  jobRole: {
    type: String,
    default: "",
  },

  interviewRound: {
    type: String,
    enum: ["HR", "Technical", "Managerial", "Coding"],
    default: "Technical",
  },

  experienceLevel: {
    type: String,
    enum: ["Fresher", "Junior", "Mid", "Senior"],
    default: "Fresher",
  },

  currentDifficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard", "Expert"],
    default: "Easy",
  },

  difficultyHistory: [
    {
      questionNo: Number,
      level: String,
    },
  ],

  askedQuestions: [String],

  skippedQuestions: [String],

  followUpQuestions: [String],

  repeatedAnswers: {
    type: Number,
    default: 0,
  },

  // Resume AI
  resumeSkills: [String],

questions: [
  {
    question: String,
    difficulty: String,
    expectedTopics: [String],
  },
],

currentQuestion: {
  type: Number,
  default: 0,
},


  detectedSkills: [
    {
      skill: String,
      score: {
        type: Number,
        default: 1,
      },
    },
  ],

  missingSkills: [String],

  strengths: [String],

  weaknesses: [String],

  learningRoadmap: [String],

  confidenceScore: {
    type: Number,
    default: 0,
  },

  communicationScore: {
    type: Number,
    default: 0,
  },

  technicalScore: {
    type: Number,
    default: 0,
  },

  overallGrade: {
    type: String,
    default: "",
  },

  hiringRecommendation: {
    type: String,
    default: "",
  },

  recommendationReason: {
    type: String,
    default: "",
  },

  score: {
    type: Number,
    default: 0,
  },

  duration: {
    type: Number,
    default: 0,
  },

  questionsAnswered: {
    type: Number,
    default: 0,
  },

  messages: [MessageSchema],

  feedback: {
    type: String,
    default: "",
  },

  isComplete: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Interview", InterviewSchema);