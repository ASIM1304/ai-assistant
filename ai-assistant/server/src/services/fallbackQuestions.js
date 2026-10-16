/**
 * Used only when the AI cannot produce a usable question (outage, repeated
 * duplicates), so a temporary AI failure never strands a candidate mid-interview.
 */
const BANK = {
  easy: [
    "Describe a recent {domain} project you worked on and what your specific contribution was.",
    "What are the core concepts a newcomer to {domain} must understand first, and why?",
    "Which tools or practices do you use daily in {domain} work, and what problem does each solve?",
  ],
  medium: [
    "Walk me through how you would debug a hard-to-reproduce problem in a {domain} system.",
    "Describe a trade-off you had to make in a {domain} project. What options did you weigh and why did you choose as you did?",
    "How do you test or validate the quality of your {domain} work before it ships?",
  ],
  hard: [
    "Describe how you would design a {domain} solution that must scale 100x. Where do the main bottlenecks appear and how would you address them?",
    "Tell me about a significant failure or outage related to {domain}. How would you prevent it from recurring?",
    "How would you evaluate and migrate a legacy {domain} system with minimal downtime?",
  ],
};

const { isSimilarQuestion } = require("../utils/text");

function pickFallback({ domain, difficulty, usedQuestions = [] }) {
  const pool = (BANK[difficulty] || BANK.medium).map((q) => q.replace("{domain}", domain));
  const all = [...pool, ...Object.values(BANK).flat().map((q) => q.replace("{domain}", domain))];
  return all.find((q) => !usedQuestions.some((u) => isSimilarQuestion(u, q))) || pool[0];
}

module.exports = { pickFallback };
