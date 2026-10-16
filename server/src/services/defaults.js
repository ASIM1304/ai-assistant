const { JobRole, QuestionCategory } = require("../models");
const { slugify } = require("../utils/text");

const DEFAULT_CATEGORIES = [
  ["Fundamentals", "Core concepts and terminology"],
  ["Problem Solving", "Reasoning through problems and trade-offs"],
  ["Design & Architecture", "Structuring systems and components"],
  ["Debugging & Troubleshooting", "Finding and fixing problems"],
  ["Best Practices", "Quality, testing, security and maintainability"],
  ["Real-world Scenarios", "Applying knowledge to practical situations"],
];

// Same labels the original app used, so history and resume recommendations keep working.
const DEFAULT_ROLES = [
  ["JavaScript/Node.js", "ES6+, async, Node runtime"],
  ["React", "Hooks, state, lifecycle"],
  ["Python", "OOP, data structures, stdlib"],
  ["Data Science", "ML, pandas, statistics"],
  ["DevOps", "CI/CD, Docker, Kubernetes"],
  ["System Design", "Scalability, architecture"],
  ["Database Design", "SQL, NoSQL, indexing"],
  ["General", "Behavioural & fundamentals"],
];

/** Seeds job roles/categories on first run (idempotent). */
async function ensureDefaults() {
  if ((await QuestionCategory.estimatedDocumentCount()) === 0) {
    await QuestionCategory.insertMany(DEFAULT_CATEGORIES.map(([name, description]) => ({ name, description })));
  }
  if ((await JobRole.estimatedDocumentCount()) === 0) {
    const names = DEFAULT_CATEGORIES.map(([n]) => n);
    await JobRole.insertMany(
      DEFAULT_ROLES.map(([label, description], i) => ({ key: slugify(label), label, description, categories: names, sortOrder: i })),
    );
  }
}

module.exports = { ensureDefaults, DEFAULT_ROLES, DEFAULT_CATEGORIES };
