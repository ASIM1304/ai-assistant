const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
    },

    question: {
      type: String,
      required: true,
    },

    expectedTopics: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Question", QuestionSchema);