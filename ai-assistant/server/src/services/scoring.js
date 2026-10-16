/**
 * Scoring rubric. The AI only supplies 0-10 criterion ratings; the overall
 * numbers are computed HERE, deterministically, so the same ratings always give
 * the same score and the model cannot "just declare" a total.
 */
const CRITERIA = ["technicalKnowledge", "accuracy", "relevance", "problemSolving", "communication", "clarity", "completeness"];
const WEIGHTS = {
  technicalKnowledge: 0.25,
  accuracy: 0.2,
  relevance: 0.1,
  problemSolving: 0.15,
  communication: 0.1,
  clarity: 0.1,
  completeness: 0.1,
};
const DIFFICULTY_WEIGHT = { easy: 0.8, medium: 1.0, hard: 1.2 };
const CRITERIA_LABELS = {
  technicalKnowledge: "Technical knowledge",
  accuracy: "Accuracy",
  relevance: "Relevance",
  problemSolving: "Problem solving",
  communication: "Communication",
  clarity: "Clarity",
  completeness: "Completeness",
};

const round = (n) => Math.round(n);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function scoreFromCriteria(criteria) {
  let total = 0;
  for (const c of CRITERIA) total += (Number(criteria[c]) || 0) * WEIGHTS[c];
  return round(Math.max(0, Math.min(10, total)) * 10);
}

const verdictFromScore = (s) => (s >= 70 ? "correct" : s >= 40 ? "partial" : "incorrect");

/**
 * questions: plain question docs. Evaluated = answered with evaluation.status "ok".
 * Skipped questions count as 0 in the overall score (so skipping isn't free);
 * unevaluated (AI failure) and unanswered (time ran out) are EXCLUDED rather
 * than penalised, and reported as such.
 */
function buildScoreSummary(questions) {
  const evaluated = questions.filter((q) => q.status === "answered" && q.evaluation?.status === "ok");
  const skipped = questions.filter((q) => q.status === "skipped");
  const unevaluated = questions.filter((q) => q.status === "answered" && q.evaluation?.status !== "ok");
  const unanswered = questions.filter((q) => q.status === "unanswered" || q.status === "asked" || q.status === "evaluating");

  const counted = [...evaluated, ...skipped];
  let weightSum = 0;
  let weighted = 0;
  for (const q of counted) {
    const w = DIFFICULTY_WEIGHT[q.difficulty] ?? 1;
    weightSum += w;
    weighted += (q.status === "skipped" ? 0 : q.evaluation.score) * w;
  }
  const overallScore = weightSum ? round(weighted / weightSum) : 0;

  const critAvg = {};
  for (const c of CRITERIA) {
    const a = avg(evaluated.map((q) => q.evaluation.criteria?.[c]).filter((v) => typeof v === "number"));
    critAvg[c] = a === null ? null : Math.round(a * 10) / 10;
  }
  const to100 = (...keys) => {
    const vals = keys.map((k) => critAvg[k]).filter((v) => v !== null);
    return vals.length ? round(avg(vals) * 10) : null;
  };

  // Skill-wise view: average of evaluated answers per category (never includes unevaluated/skipped).
  const byCat = new Map();
  for (const q of evaluated) {
    const c = q.category || "General";
    const e = byCat.get(c) || { sum: 0, n: 0 };
    e.sum += q.evaluation.score;
    e.n++;
    byCat.set(c, e);
  }
  const categoryScores = [...byCat.entries()].map(([category, e]) => ({ category, average: round(e.sum / e.n), questions: e.n })).sort((a, b) => b.average - a.average);
  const criteriaScores = Object.fromEntries(CRITERIA.map((c) => [c, critAvg[c] === null ? null : round(critAvg[c] * 10)]));

  return {
    overallScore,
    categoryScores,
    criteriaScores,
    technicalScore: to100("technicalKnowledge"),
    accuracyScore: to100("accuracy"),
    communicationScore: to100("communication", "clarity"),
    problemSolvingScore: to100("problemSolving"),
    criteriaAverages: critAvg,
    questionScores: questions.map((q) => ({
      questionNumber: q.questionNumber,
      difficulty: q.difficulty,
      category: q.category,
      status: q.status,
      score: q.status === "skipped" ? 0 : q.evaluation?.status === "ok" ? q.evaluation.score : null,
      timeSpentSeconds: q.timeSpentSeconds ?? null,
    })),
    difficultyProgression: questions.map((q) => q.difficulty),
    counts: {
      asked: questions.length,
      evaluated: evaluated.length,
      skipped: skipped.length,
      unevaluated: unevaluated.length,
      unanswered: unanswered.length,
    },
  };
}

module.exports = { CRITERIA, WEIGHTS, CRITERIA_LABELS, scoreFromCriteria, verdictFromScore, buildScoreSummary, DIFFICULTY_WEIGHT };
