/** Shapes data for the candidate UI. Evaluation numbers are withheld until the interview ends. */
const TERMINAL = ["completed", "terminated", "abandoned", "expired"];

function currentQuestionView(q) {
  if (!q) return null;
  return {
    id: q._id.toString(),
    questionNumber: q.questionNumber,
    question: q.question,
    category: q.category,
    questionType: q.questionType,
    difficulty: q.difficulty,
    shortAnswerWarned: !!q.shortAnswerWarned,
  };
}

function historyItem(q, { reveal }) {
  const item = {
    id: q._id.toString(),
    questionNumber: q.questionNumber,
    question: q.question,
    category: q.category,
    questionType: q.questionType,
    difficulty: q.difficulty,
    status: q.status,
    answer: q.answer,
    feedback: q.feedback,
    verdict: q.evaluation?.verdict,
    evaluationStatus: q.evaluation?.status,
    isFollowUp: !!q.isFollowUp,
    askedAt: q.askedAt,
    answeredAt: q.answeredAt,
  };
  if (reveal) {
    item.score = q.status === "skipped" ? 0 : q.evaluation?.score ?? null;
    item.criteria = q.evaluation?.criteria;
    item.strengths = q.strengths;
    item.improvements = q.improvements;
    item.timeSpentSeconds = q.timeSpentSeconds;
    item.source = q.source;
    item.isFollowUp = !!q.isFollowUp;
    item.explanations = q.evaluation?.explanations;
    item.evidence = q.evaluation?.evidence || [];
    item.suggestions = q.suggestions || [];
    item.modelAnswer = q.modelAnswer;
  }
  return item;
}

const isTerminal = (status) => TERMINAL.includes(status);

module.exports = { currentQuestionView, historyItem, isTerminal };
