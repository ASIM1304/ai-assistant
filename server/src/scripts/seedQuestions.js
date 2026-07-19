const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("../config/db");
const Question = require("../models/Question");

const questions = [
  {
    domain: "JavaScript",
    difficulty: "Easy",
    question: "What is JavaScript?",
    expectedTopics: ["language", "web", "programming"]
  },
  {
    domain: "JavaScript",
    difficulty: "Easy",
    question: "What is the difference between var, let and const?",
    expectedTopics: ["scope", "hoisting", "block scope"]
  },
  {
    domain: "JavaScript",
    difficulty: "Medium",
    question: "Explain closures with an example.",
    expectedTopics: ["closure", "lexical scope"]
  },
  {
    domain: "JavaScript",
    difficulty: "Medium",
    question: "What are promises?",
    expectedTopics: ["async", "promise"]
  },
  {
    domain: "JavaScript",
    difficulty: "Hard",
    question: "Explain the JavaScript event loop.",
    expectedTopics: ["event loop", "call stack", "callback queue"]
  }
];

async function seedQuestions() {
  try {
    await connectDB();

    await Question.deleteMany({});

    await Question.insertMany(questions);

    console.log("✅ Questions inserted successfully");

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seedQuestions();