const { Question, SecurityEvent, InterviewReport, Interview } = require("../models");
const ai = require("./ai");
const { buildScoreSummary, CRITERIA, CRITERIA_LABELS } = require("./scoring");
const { summarizeEvents } = require("./proctoring");

const DISCLAIMER =
  "Scores, strengths, weaknesses and recommendations are automated, AI-assisted assessments. They can contain errors or bias and are not objective facts or a hiring decision. Timings, counts and security events are measured by the server.";

const ADVICE = {
  technicalKnowledge: "Review core concepts for this role and practise explaining how they work under the hood.",
  accuracy: "Double-check technical details before answering; practise with quizzes or code reviews to catch common mistakes.",
  relevance: "Answer the exact question asked first, then add supporting detail.",
  problemSolving: "Practise talking through your approach step by step: constraints, options, trade-offs, then a decision.",
  communication: "Practise explaining complex ideas aloud in plain language, as if to a colleague from another team.",
  clarity: "Structure answers (context, approach, result) and keep sentences short.",
  completeness: "Cover edge cases and give concrete examples to make answers more complete.",
};

/** Practice plan from the weakest criteria/categories, no AI needed. Never invents resources. */
function ruleBasedPlan(summary) {
  const items = [];
  const weakCriteria = CRITERIA.map((c) => [c, summary.criteriaAverages[c]]).filter(([, v]) => v !== null && v <= 6.5).sort((a, b) => a[1] - b[1]).slice(0, 3);
  for (const [k, v] of weakCriteria) items.push({ focus: CRITERIA_LABELS[k], why: `Your average on this criterion was ${v}/10.`, actions: [ADVICE[k]] });
  const weakCats = (summary.categoryScores || []).filter((c) => c.average < 65).slice(-2);
  for (const c of weakCats) items.push({ focus: `${c.category} topics`, why: `Average ${c.average}/100 across ${c.questions} question(s).`, actions: [`Practise 3-5 ${c.category} questions and compare your answers with the model answers in this report.`, "Re-take a short interview in a few days to measure progress."] });
  return items.slice(0, 5);
}

function ruleBasedNarrative(summary) {
  const entries = CRITERIA.map((c) => [c, summary.criteriaAverages[c]]).filter(([, v]) => v !== null);
  if (!entries.length) {
    return {
      summary: "There was not enough evaluated answer data to produce an assessment.",
      strengths: [],
      weaknesses: [],
      recommendations: ["Complete a full interview to receive a detailed assessment."],
      practicePlan: [],
    };
  }
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const strengths = sorted.filter(([, v]) => v >= 7).slice(0, 3).map(([k, v]) => `${CRITERIA_LABELS[k]} was a relative strength (average ${v}/10).`);
  const weak = [...sorted].reverse().filter(([, v]) => v <= 6).slice(0, 3);
  return {
    summary: `Automated summary: overall score ${summary.overallScore}/100 across ${summary.counts.evaluated} evaluated question(s). The AI-written narrative was unavailable, so this summary was generated from the criterion ratings.`,
    strengths,
    weaknesses: weak.map(([k, v]) => `${CRITERIA_LABELS[k]} needs improvement (average ${v}/10).`),
    recommendations: weak.map(([k]) => ADVICE[k]),
    practicePlan: ruleBasedPlan(summary),
  };
}

/**
 * Builds (once) the immutable report for a finished interview. Idempotent: safe
 * to call repeatedly or concurrently (unique index on interviewId).
 */
async function ensureReport(interview) {
  const existing = await InterviewReport.findOne({ interviewId: interview._id });
  if (existing) return existing;
  if (!interview.startedAt) return null; // never started: nothing to report

  const [questions, events] = await Promise.all([
    Question.find({ interviewId: interview._id }).sort({ questionNumber: 1 }).lean(),
    SecurityEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 }).lean(),
  ]);
  const summary = buildScoreSummary(questions);

  let narrative;
  let narrativeSource = "ai";
  if (summary.counts.evaluated === 0) {
    narrative = ruleBasedNarrative(summary);
    narrativeSource = "none";
  } else {
    try {
      narrative = await ai.generateReportNarrative({
        domain: interview.domain,
        interviewType: interview.interviewType,
        categoryScores: summary.categoryScores,
        criteriaAverages: summary.criteriaAverages,
        counts: summary.counts,
        perQuestion: questions
          .filter((q) => q.status === "answered" && q.evaluation?.status === "ok")
          .map((q) => ({ n: q.questionNumber, difficulty: q.difficulty, category: q.category, score: q.evaluation.score, feedback: q.feedback })),
      });
    } catch {
      narrative = ruleBasedNarrative(summary);
      narrativeSource = "rule_based";
    }
  }

  // Practice plan: AI-written if it gave one, otherwise derived from the scores.
  let practicePlan = narrative.practicePlan || [];
  let practicePlanSource = narrativeSource === "ai" ? "ai" : "rule_based"; // label by how it was actually produced
  if (!practicePlan.length) {
    practicePlan = ruleBasedPlan(summary);
    practicePlanSource = "rule_based";
  }
  if (!practicePlan.length) practicePlanSource = "none";
  const security = summarizeEvents(events);
  let report;
  try {
    report = await InterviewReport.create({
      interviewId: interview._id,
      userId: interview.userId,
      overallScore: summary.overallScore,
      technicalScore: summary.technicalScore,
      accuracyScore: summary.accuracyScore,
      communicationScore: summary.communicationScore,
      problemSolvingScore: summary.problemSolvingScore,
      questionScores: summary.questionScores,
      difficultyProgression: summary.difficultyProgression,
      interviewType: interview.interviewType,
      skillScores: summary.categoryScores,
      criteriaScores: summary.criteriaScores,
      practicePlan,
      practicePlanSource,
      summary: narrative.summary,
      strengths: narrative.strengths,
      weaknesses: narrative.weaknesses,
      recommendations: narrative.recommendations,
      narrativeSource,
      facts: {
        jobRole: interview.domain,
        interviewType: interview.interviewType,
        followUpQuestions: questions.filter((q) => q.isFollowUp).length,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        durationSeconds: interview.durationSeconds,
        endStatus: interview.status,
        endReason: interview.endReason || null,
        plannedQuestions: interview.config.totalQuestions,
        counts: summary.counts,
        criteriaAverages: summary.criteriaAverages,
        security,
        flaggedForReview: interview.flaggedForReview,
      },
      provenance: {
        facts: "Measured by the server (timings, counts, security events).",
        scores:
          "Per-answer criterion ratings (0-10) come from an AI model; per-question and overall scores are computed with fixed weights. Skipped questions count as 0; unevaluated and unanswered questions are excluded.",
        narrative: narrativeSource === "ai" ? "Written by an AI model from the ratings." : narrativeSource === "rule_based" ? "Generated by rules from the ratings (AI unavailable)." : "Not generated.",
      },
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    if (err.code === 11000) return InterviewReport.findOne({ interviewId: interview._id });
    throw err;
  }
  await Interview.updateOne({ _id: interview._id }, { $set: { reportId: report._id, score: summary.overallScore } });
  return report;
}

module.exports = { ensureReport, ruleBasedNarrative, ruleBasedPlan, DISCLAIMER };
