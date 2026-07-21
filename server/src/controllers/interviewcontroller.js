const Groq = require("groq-sdk");
const Interview = require("../models/Interview");
const InterviewReport = require("../models/InterviewReport");
const Question = require("../models/Question");
// ======================================================
// Groq Configuration
// ======================================================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ======================================================
// Interview Configuration
// ======================================================

const TOTAL_QUESTIONS = 10;

const DIFFICULTY = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
};

const PERFORMANCE = {
  GOOD: "good",
  AVERAGE: "average",
  POOR: "poor",
};

const DEFAULT_COMPANY = "General";

const DEFAULT_INTERVIEWER = "Technical";

// ======================================================
// System Prompt Builder
// ======================================================

function buildSystemPrompt({
  domain,
  company,
  interviewer,
  difficulty,
}) {
  return `
You are an experienced ${company} ${interviewer} interviewer.

Interview Domain:
${domain}

Current Difficulty:
${difficulty}

Rules:

1. Ask only ONE interview question.
2. Wait for the candidate's answer.
3. Never reveal the answer.
4. Never give hints.
5. Behave like a real interviewer.
6. Adapt the difficulty based on candidate performance.
7. Keep questions professional and realistic.

Return ONLY the interview question.
`;
}

// ======================================================
// Difficulty Helpers
// ======================================================

function getInitialDifficulty() {
  return DIFFICULTY.EASY;
}

function increaseDifficulty(level) {
  switch (level) {
    case DIFFICULTY.EASY:
      return DIFFICULTY.MEDIUM;

    case DIFFICULTY.MEDIUM:
      return DIFFICULTY.HARD;

    case DIFFICULTY.HARD:
      return DIFFICULTY.EXPERT;

    default:
      return DIFFICULTY.EXPERT;
  }
}

function decreaseDifficulty(level) {
  switch (level) {
    case DIFFICULTY.EXPERT:
      return DIFFICULTY.HARD;

    case DIFFICULTY.HARD:
      return DIFFICULTY.MEDIUM;

    case DIFFICULTY.MEDIUM:
      return DIFFICULTY.EASY;

    default:
      return DIFFICULTY.EASY;
  }
}

// ======================================================
// Common Helpers
// ======================================================

function normalizeText(text = "") {
  return text.trim().toLowerCase();
}

function getCurrentTime() {
  return new Date();
}

function isSkippedAnswer(answer = "") {
  const skipped = [
    "",
    "skip",
    "pass",
    "next",
    "idk",
    "i don't know",
    "dont know",
    "no idea",
  ];

  return skipped.includes(normalizeText(answer));
}

function calculateProgress(answered) {
  return Math.min(
    100,
    Math.round((answered / TOTAL_QUESTIONS) * 100)
  );
}

function getLastQuestion(interview) {
  const aiMessages = interview.messages.filter(
    (message) => message.role === "ai"
  );

  if (aiMessages.length === 0) {
    return "";
  }

  return aiMessages[aiMessages.length - 1].content;
}

function getConversationHistory(interview) {
  return interview.messages
    .map((message) => {
      return `${message.role.toUpperCase()}: ${message.content}`;
    })
    .join("\n");
}

function hasQuestionBeenAsked(interview, question) {
  return interview.askedQuestions.some(
    (item) =>
      item.trim().toLowerCase() ===
      question.trim().toLowerCase()
  );
}

function storeQuestion(interview, question) {
  if (!hasQuestionBeenAsked(interview, question)) {
    interview.askedQuestions.push(question);
  }
}

function updateConfidence(interview, confidence) {
  interview.confidenceScore = confidence;
}

function updateDetectedSkills(interview, skills) {
  if (!skills || !skills.length) return;

  skills.forEach((skill) => {
    const existing = interview.detectedSkills.find(
      (item) =>
        item.skill.toLowerCase() === skill.toLowerCase()
    );

    if (existing) {
      existing.score += 1;
    } else {
      interview.detectedSkills.push({
        skill,
        score: 1,
      });
    }
  });
}

function getDifficultyBadge(level) {
  switch (level) {
    case DIFFICULTY.EASY:
      return "🟢 Easy";

    case DIFFICULTY.MEDIUM:
      return "🟡 Medium";

    case DIFFICULTY.HARD:
      return "🟠 Hard";

    case DIFFICULTY.EXPERT:
      return "🔴 Expert";

    default:
      return "⚪ Unknown";
  }
}

// ======================================================
// Domain Matching (with graceful fallbacks)
// ======================================================

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findQuestionsForDomain(domain) {
  const raw = domain.trim();
  const safe = escapeRegex(raw);

  // 1. Exact match, case-insensitive
  let questions = await Question.aggregate([
    { $match: { domain: { $regex: `^${safe}$`, $options: "i" } } },
    { $sample: { size: 10 } },
  ]);

  if (questions.length > 0) return questions;

  // 2. Partial match, e.g. "javascript" -> "JavaScript/Node.js"
  questions = await Question.aggregate([
    { $match: { domain: { $regex: safe, $options: "i" } } },
    { $sample: { size: 10 } },
  ]);

  if (questions.length > 0) return questions;

  // 3. Compound domains like "JavaScript/Node.js" don't literally exist in
  // the question bank — it stores "JavaScript" and "Node.js" separately.
  // Split on "/" (and ",") and match ANY of the parts.
  const parts = raw
    .split(/[\/,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    questions = await Question.aggregate([
      {
        $match: {
          $or: parts.map((p) => ({
            domain: { $regex: escapeRegex(p), $options: "i" },
          })),
        },
      },
      { $sample: { size: 10 } },
    ]);

    if (questions.length > 0) return questions;
  }

  // 4. Fall back to a literal "General" bucket, if one has been seeded
  questions = await Question.aggregate([
    { $match: { domain: { $regex: "^General$", $options: "i" } } },
    { $sample: { size: 10 } },
  ]);

  if (questions.length > 0) return questions;

  // 5. Last resort: sample from the whole bank so domains with no
  // dedicated questions yet (Data Science, DevOps, System Design...)
  // still work. A 404 should now only happen if the bank is fully empty.
  questions = await Question.aggregate([{ $sample: { size: 10 } }]);

  return questions;
}
// ======================================================
// Start Resume Based Interview
// ======================================================

const startInterview = async (req, res) => {

  try {

    const {

      domain,

      company = "General",

      jobRole = "Software Engineer",

      interviewRound = "Technical",

      experienceLevel = "Fresher",

      resumeSkills = [],

      resumeScore = 0,

    } = req.body;

    if (!domain) {

      return res.status(400).json({

        success: false,

        message: "Interview domain is required.",

      });

    }

    const difficulty = getInitialDifficulty();

    const systemPrompt = `
You are a senior interviewer at ${company}.

Candidate Details

Domain: ${domain}

Role: ${jobRole}

Interview Round: ${interviewRound}

Experience: ${experienceLevel}

Resume Skills:

${resumeSkills.join(", ") || "Not Available"}

Rules:

1. Ask ONE interview question.

2. Focus on resume skills.

3. If no skills are available,
ask domain-based questions.

4. Behave like a real interviewer.

5. Company style should match ${company}.

Return ONLY the question.
`;

    const questions = await findQuestionsForDomain(domain);

if (questions.length === 0) {
  return res.status(404).json({
    success: false,
    message:
      "No interview questions found for this domain, and no fallback questions exist. Please seed the question bank.",
  });
}

const firstQuestion = questions[0].question;
const interview = await Interview.create({
  userId: req.userId,
  domain,
  company,
  jobRole,
  interviewRound,
  experienceLevel,
  resumeSkills,
  resumeScore,

  questions,
  currentQuestion: 0,

  currentDifficulty: difficulty,

  askedQuestions: [firstQuestion],

  messages: [
    {
      role: "ai",
      content: firstQuestion,
      timestamp: new Date(),
    },
  ],
});
    

      

    return res.status(201).json({

      success: true,

      sessionId: interview._id,

      company,

      role: jobRole,

      round: interviewRound,

      difficulty,

      question: firstQuestion,

      progress: 0,

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }

};
// ======================================================
// AI Candidate Evaluation Engine
// ======================================================

async function evaluateCandidateAnswer({

  domain,

  difficulty,

  question,

  answer,

}) {

  const prompt = `
You are an experienced technical interviewer.

Interview Domain:
${domain}

Difficulty:
${difficulty}

Question:
${question}

Candidate Answer:
${answer}

Evaluate the answer on:

1. Technical Accuracy (0-100)
2. Communication Skills (0-100)
3. Confidence (0-100)
4. Problem Solving (0-100)

Detect all important technical skills mentioned.

Finally classify performance as:

good
average
poor

Return ONLY valid JSON.

Example:

{
  "technicalScore":85,
  "communicationScore":80,
  "problemSolvingScore":82,
  "confidence":88,
  "performance":"good",
  "feedback":"Excellent explanation with clear technical understanding.",
  "skills":[
      "React",
      "Hooks",
      "JavaScript"
  ]
}
`;

  try {

    const completion =
      await groq.chat.completions.create({

        model: "llama-3.3-70b-versatile",

        temperature: 0.3,

        messages: [

          {

            role: "system",

            content: "Return JSON only."

          },

          {

            role: "user",

            content: prompt

          }

        ]

      });

    const response =
      completion.choices[0].message.content.trim();

    return JSON.parse(response);

  }

  catch (error) {

    console.error("Evaluation Error:", error);

    return {

      technicalScore: 70,

      communicationScore: 70,

      problemSolvingScore: 70,

      confidence: 70,

      performance: PERFORMANCE.AVERAGE,

      feedback:
        "The answer was understandable but needs more technical depth and clearer explanation.",

      skills: []

    };

  }

}

// ======================================================
// Performance Calculator
// ======================================================

function calculateOverallScore(result) {

  return Math.round(

    (

      result.technicalScore +

      result.communicationScore +

      result.problemSolvingScore +

      result.confidence

    ) / 4

  );

}

// ======================================================
// Performance Classification
// ======================================================

function getPerformanceLevel(score) {

  if (score >= 85) {

    return PERFORMANCE.GOOD;

  }

  if (score >= 60) {

    return PERFORMANCE.AVERAGE;

  }

  return PERFORMANCE.POOR;

}

// ======================================================
// Repeated Answer Detection
// ======================================================

function isRepeatedAnswer(interview, answer) {

  const normalized =
    answer.trim().toLowerCase();

  const previousAnswers = interview.messages

    .filter(

      (message) =>

        message.role === "user"

    )

    .map(

      (message) =>

        message.content.trim().toLowerCase()

    );

  return previousAnswers.includes(normalized);

}

// ======================================================
// Skipped Question Handler
// ======================================================

function saveSkippedQuestion(

  interview,

  question

) {

  if (!question) {

    return;

  }

  interview.skippedQuestions.push(question);

}

// ======================================================
// Interview Statistics
// ======================================================

function updateInterviewStatistics(

  interview,

  evaluation

) {

  interview.questionsAnswered++;

  interview.feedback =
    evaluation.feedback;

  interview.score =
    calculateOverallScore(evaluation);

  interview.confidenceScore =
    evaluation.confidence;

  interview.technicalScore =
    evaluation.technicalScore;

  interview.communicationScore =
    evaluation.communicationScore;

  interview.problemSolvingScore =
    evaluation.problemSolvingScore;

}

// ======================================================
// Skill Tracker
// ======================================================

function updateSkillScores(

  interview,

  skills

) {

  if (!skills || skills.length === 0) {

    return;

  }

  skills.forEach((skill) => {

    const existing =
      interview.detectedSkills.find(

        (item) =>

          item.skill.toLowerCase() ===

          skill.toLowerCase()

      );

    if (existing) {

      existing.score++;

    }

    else {

      interview.detectedSkills.push({

        skill,

        score: 1,

      });

    }

  });

}
// ======================================================
// Adaptive Question Engine
// ======================================================

function decideDifficulty(performance, currentDifficulty) {

  switch (performance) {

    case PERFORMANCE.GOOD:

      return increaseDifficulty(currentDifficulty);

    case PERFORMANCE.POOR:

      return decreaseDifficulty(currentDifficulty);

    default:

      return currentDifficulty;

  }

}

function saveDifficulty(interview, difficulty) {

  interview.currentDifficulty = difficulty;

  interview.difficultyHistory.push({

    questionNo: interview.questionsAnswered + 1,

    level: difficulty,

  });

}

function buildNextQuestionPrompt({

  interview,

  previousQuestion,

  candidateAnswer,

}) {

  return `
You are an experienced technical interviewer.

Interview Domain:
${interview.domain}

Company:
${interview.company}

Current Difficulty:
${interview.currentDifficulty}

Previous Question:
${previousQuestion}

Candidate Answer:
${candidateAnswer}

Conversation History:
${getConversationHistory(interview)}

Rules:

1. Ask ONLY one interview question.

2. Never repeat any previous question.

3. Continue naturally.

4. Ask follow-up questions whenever possible.

5. Increase complexity if the candidate performs well.

6. Reduce complexity if the candidate struggles.

7. Behave exactly like a real interviewer.

Return ONLY the next interview question.
`;

}

async function generateNextQuestion({

  interview,

  answer,

}) {

  const previousQuestion =
    getLastQuestion(interview);

  const prompt = buildNextQuestionPrompt({

    interview,

    previousQuestion,

    candidateAnswer: answer,

  });

  const completion =
    await groq.chat.completions.create({

      model: "llama-3.3-70b-versatile",

      temperature: 0.7,

      messages: [

        {

          role: "system",

          content: prompt,

        },

        {

          role: "user",

          content:
            "Generate the next interview question.",

        },

      ],

    });

  let nextQuestion =
    completion.choices[0].message.content.trim();

  if (hasQuestionBeenAsked(interview, nextQuestion)) {

    const retry =
      await groq.chat.completions.create({

        model: "llama-3.3-70b-versatile",

        temperature: 0.9,

        messages: [

          {

            role: "system",

            content:
              prompt +
              "\nGenerate a completely different interview question.",

          },

          {

            role: "user",

            content:
              "Avoid duplicate questions.",

          },

        ],

      });

    nextQuestion =
      retry.choices[0].message.content.trim();

  }

  storeQuestion(interview, nextQuestion);

  interview.followUpQuestions.push(nextQuestion);

  return nextQuestion;

}

// ======================================================
// Interview Completion
// ======================================================

function shouldFinishInterview(interview) {

  return interview.questionsAnswered >= TOTAL_QUESTIONS;

}

function calculateInterviewDuration(interview) {

  return Math.max(

    1,

    Math.round(

      (

        Date.now() -

        interview.createdAt.getTime()

      ) / 60000

    )

  );

}

function getInterviewStatus(interview) {

  return {

    progress: calculateProgress(

      interview.questionsAnswered

    ),

    difficulty: interview.currentDifficulty,

    difficultyBadge: getDifficultyBadge(

      interview.currentDifficulty

    ),

    questionsAnswered: interview.questionsAnswered,

    totalQuestions: TOTAL_QUESTIONS,

    completed: shouldFinishInterview(interview),

  };

}
// ======================================================
// Submit Candidate Answer
// ======================================================
   const submitAnswer = async (req, res) => {

  try {

    const {

      sessionId,

      answer,

    } = req.body;

    if (!sessionId || !answer) {

      return res.status(400).json({

        success: false,

        message: "Session ID and answer are required.",

      });

    }

    const interview = await Interview.findOne({

      _id: sessionId,

      userId: req.userId,

    });

    if (!interview) {

      return res.status(404).json({

        success: false,

        message: "Interview session not found.",

      });

    }

    if (interview.isComplete) {

      return res.status(400).json({

        success: false,

        message: "Interview already completed.",

      });

    }

    const previousQuestion = getLastQuestion(interview);

    interview.messages.push({

      role: "user",

      content: answer,

      timestamp: getCurrentTime(),

    });

    const evaluation = await evaluateCandidateAnswer({

      domain: interview.domain,

      difficulty: interview.currentDifficulty,

      question: previousQuestion,

      answer,

    });

    updateSkillScores(

      interview,

      evaluation.skills

    );

    updateConfidence(

      interview,

      evaluation.confidence

    );

    updateInterviewStatistics(

      interview,

      evaluation

    );

    const nextDifficulty = decideDifficulty(

      evaluation.performance,

      interview.currentDifficulty

    );

    saveDifficulty(

      interview,

      nextDifficulty

    );
    console.log("Questions Answered:", interview.questionsAnswered);
console.log("Total Questions:", TOTAL_QUESTIONS);

if (shouldFinishInterview(interview)) {
    console.log("Interview Completed");

    interview.isComplete = true;


      interview.duration = calculateInterviewDuration(interview);

      interview.messages.push({

        role: "ai",

        content: evaluation.feedback,

        timestamp: getCurrentTime(),

      });

      try {

        await InterviewReport.create({

          user: interview.userId,

          interview: interview._id,

          domain: interview.domain,

          company: interview.company,

          jobRole: interview.jobRole,

          experienceLevel: interview.experienceLevel,

          resumeScore: interview.resumeScore || 0,

          interviewScore: interview.score,

          technicalScore: evaluation.technicalScore,

          communicationScore: evaluation.communicationScore,

          confidenceScore: evaluation.confidence,

          problemSolvingScore: evaluation.problemSolvingScore,

          detectedSkills: interview.detectedSkills,

          strengths: [],

          weaknesses: [],

          missingSkills: [],

          recommendedRoles: [],

          recommendedCompanies: [],

          learningResources: generateLearningPath(interview),

          hiringRecommendation:
            generateHiringRecommendation(interview),

        });

        console.log("✅ Interview report saved");

      } catch (err) {

        console.error("❌ Report Save Error:", err);

      }

      await interview.save();

      return res.json({

        success: true,

        completed: true,

        feedback: evaluation.feedback,

        score: interview.score,

        technicalScore: interview.technicalScore,

        communicationScore: interview.communicationScore,

        problemSolvingScore: interview.problemSolvingScore,

        confidence: interview.confidenceScore,

        detectedSkills: interview.detectedSkills,

        duration: interview.duration,

        status: getInterviewStatus(interview),

      });

    }

let nextQuestion = null;

try {

  // Live adaptive question: Groq sees the conversation history,
  // current difficulty, and the answer just given, and generates
  // a follow-up that never repeats a previously asked question.
  nextQuestion = await generateNextQuestion({
    interview,
    answer,
  });

} catch (err) {

  console.error("Next Question Generation Error:", err);

  // Fallback: pull the next question from the pre-sampled bank
  // so a Groq hiccup doesn't stall the interview.
  interview.currentQuestion++;

  if (interview.currentQuestion < interview.questions.length) {
    nextQuestion = interview.questions[interview.currentQuestion].question;
    storeQuestion(interview, nextQuestion);
  }

}

    interview.messages.push({

      role: "ai",

      content: evaluation.feedback,

      timestamp: getCurrentTime(),

    });

    if (nextQuestion) {

  interview.messages.push({
    role: "ai",
    content: nextQuestion,
    timestamp: getCurrentTime(),
  });

}

    await interview.save();

    return res.json({

      success: true,

      completed: false,

      feedback: evaluation.feedback,

      nextQuestion,

      score: interview.score,

      technicalScore: interview.technicalScore,

      communicationScore: interview.communicationScore,

      problemSolvingScore: interview.problemSolvingScore,

      confidence: interview.confidenceScore,

      detectedSkills: interview.detectedSkills,

      status: getInterviewStatus(interview),

    });
      }

  catch (error) {

    console.error("Submit Answer Error:", error);

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }

};
// ======================================================
// AI Hiring Recommendation
// ======================================================

function generateHiringRecommendation(interview) {

  const score = interview.score;

  if (score >= 90) {

    return "Strong Hire";

  }

  if (score >= 75) {

    return "Hire";

  }

  if (score >= 60) {

    return "Consider";

  }

  return "Reject";

}

// ======================================================
// AI Learning Path Generator
// ======================================================

function generateLearningPath(interview) {

  const skills = interview.detectedSkills.map(

    (item) => item.skill.toLowerCase()

  );

  const roadmap = [];

  if (!skills.includes("javascript")) {

    roadmap.push("Master JavaScript Fundamentals");

  }

  if (!skills.includes("react")) {

    roadmap.push("Build Projects using React");

  }

  if (!skills.includes("node.js")) {

    roadmap.push("Learn Backend Development with Node.js");

  }

  if (!skills.includes("mongodb")) {

    roadmap.push("Practice MongoDB CRUD Operations");

  }

  if (!skills.includes("express")) {

    roadmap.push("Develop REST APIs using Express.js");

  }

  if (roadmap.length === 0) {

    roadmap.push("Practice Advanced Data Structures");

    roadmap.push("Solve Real Interview Problems");

    roadmap.push("Participate in Mock Interviews");

  }

  return roadmap;

}

// ======================================================
// Get All Interviews
// ======================================================

const getInterviews = async (req, res) => {

  try {

   const interviews = await Interview.find({
    userId: req.userId,
}).sort({ createdAt: -1 });

    return res.json({

      success: true,

      interviews,

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }

};

// ======================================================
// Get Single Interview
// ======================================================

const getInterview = async (req, res) => {

  try {

    const interview = await Interview.findOne({

      _id: req.params.id,

      userId: req.userId,

    });

    if (!interview) {

      return res.status(404).json({

        success: false,

        message: "Interview not found.",

      });

    }

    // Read-only endpoint — compute derived fields for the response
    // without persisting them (avoids overwriting concurrent writes
    // from submitAnswer, and avoids side effects on a GET request).
    const responseInterview = interview.toObject();
    responseInterview.hiringRecommendation =
      generateHiringRecommendation(interview);
    responseInterview.learningPath =
      generateLearningPath(interview);

    return res.json({

      success: true,

      interview: responseInterview,

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message,

    });

  }

};

// ======================================================
// Export Controllers
// ======================================================

module.exports = {

  startInterview,

  submitAnswer,

  getInterviews,

  getInterview,

};