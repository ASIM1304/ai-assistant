const Groq = require("groq-sdk");
const Interview = require("../models/Interview.js");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Interview auto-ends once the candidate accumulates this many proctoring warnings
const MAX_WARNINGS = 5;

// Interview structure: 10 questions total, 2 of which are coding challenges
// (question numbers, 1-indexed, spaced out so they don't land back-to-back)
const TOTAL_QUESTIONS = 10;
const CODING_QUESTION_NUMBERS = [4, 8];

const systemPrompt = (domain) =>
  `
You are a senior technical interviewer conducting a mock interview for a ${domain} developer role.
Ask one clear, specific technical question at a time.
After the candidate answers, provide feedback and the next question.

Return ONLY the question, nothing else.


`.trim();

// ── Start Interview ───────────────────────────────────────
const startInterview = async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: "Domain is required" });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt(domain) },
        {
          role: "user",
          content: `Start the interview. Ask me the first ${domain} technical question. Only ask the question, no preamble.`,
        },
      ],
      temperature: 0.7,
    });

    const firstQuestion =
      completion.choices[0].message.content ||
      "Tell me about yourself and your experience.";

    const interview = await Interview.create({
      userId: req.userId,
      domain,
      messages: [
        { role: "ai", content: firstQuestion, questionType: "behavioral" },
      ],
      cameraEnabled: !!req.body.cameraEnabled,
    });

    res.status(201).json({
      sessionId: interview._id,
      question: firstQuestion,
      questionType: "behavioral",
      totalQuestions: TOTAL_QUESTIONS,
    });
  } catch (err) {
    console.error("startInterview error:", err);
    res
      .status(500)
      .json({ message: "Failed to start interview", error: err.message });
  }
};

// ── Submit Answer ─────────────────────────────────────────
const submitAnswer = async (req, res) => {
  try {
    const {
      sessionId,
      answer,
      domain = "General",
      questionsAnswered = 0,
    } = req.body;

    if (!sessionId || !answer)
      return res.status(400).json({ message: "Missing required fields" });

    const interview = await Interview.findOne({
      _id: sessionId,
      userId: req.userId,
    });
    if (!interview)
      return res.status(404).json({ message: "Session not found" });

    const lastAiMessage = [...interview.messages]
      .reverse()
      .find((m) => m.role === "ai");
    const lastQuestion = lastAiMessage?.content || "";
    const lastQuestionType = lastAiMessage?.questionType || "behavioral";

    // 1️⃣ Grade correctness first — this drives whether we go deeper or reset to a general question
    const gradeResponse = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        {
          role: "user",
          content: `You are grading a candidate's answer in a ${domain} interview.
${lastQuestionType === "coding" ? "This is a CODING question — judge correctness of logic and approach, not just whether it compiles or uses perfect syntax." : ""}

Question asked: "${lastQuestion}"
Candidate's answer: "${answer}"

Judge the answer's technical correctness. Respond with ONLY one word, exactly one of:
correct
partial
incorrect`,
        },
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const rawGrade = (gradeResponse.choices[0].message.content || "")
      .trim()
      .toLowerCase();
    // Substring match, not exact equality — the model may wrap the word in
    // punctuation or a short phrase despite instructions. Check "incorrect"
    // before "correct" since the former contains the latter as a substring.
    const evaluation = rawGrade.includes("incorrect")
      ? "incorrect"
      : rawGrade.includes("partial")
        ? "partial"
        : rawGrade.includes("correct")
          ? "correct"
          : "partial";

    // 2️⃣ Generate feedback on the answer
    const feedbackResponse = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [
        {
          role: "user",
          content: `You are an expert ${domain} interview evaluator.
The candidate's answer has been graded as: ${evaluation}.
Provide constructive feedback on this interview answer in 2-3 sentences.
Focus on:
- Clarity and structure of the response
- Technical accuracy and depth
- Communication skills
- Areas for improvement
${evaluation === "incorrect" ? "- Gently point out that the core answer was incorrect and briefly explain the correct idea" : ""}

Answer: "${answer}"

Return ONLY the feedback, no additional text.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const feedback = feedbackResponse.choices[0].message.content.trim();

    const isComplete = questionsAnswered >= TOTAL_QUESTIONS - 1;

    // 3️⃣ Save messages to DB
    interview.messages.push({
      role: "user",
      content: answer,
      timestamp: new Date(),
      evaluation,
    });
    interview.messages.push({
      role: "ai",
      content: feedback,
      timestamp: new Date(),
    });
    interview.questionsAnswered = questionsAnswered + 1;

    // ── Complete path ──────────────────────────────────────
    if (isComplete) {
      // Build a full transcript of every question+answer+evaluation so far,
      // instead of scoring off just the last answer (which under-weights
      // everything the candidate got right earlier in the session).
      const transcript = interview.messages
        .map((m) => {
          if (m.role === "ai") return `Interviewer: ${m.content}`;
          return `Candidate (${m.evaluation ?? "ungraded"}): ${m.content}`;
        })
        .join("\n");

      // Deterministic baseline from the per-answer grades we already computed —
      // this anchors the score so one bad final answer can't tank an otherwise
      // strong session, and one lucky answer can't inflate a weak one.
      const gradePoints = {
        correct: 100,
        partial: 60,
        incorrect: 20,
      };
      const graded = interview.messages.filter(
        (m) => m.role === "user" && m.evaluation,
      );
      const baselineScore = graded.length
        ? Math.round(
            graded.reduce(
              (sum, m) => sum + (gradePoints[m.evaluation] ?? 60),
              0,
            ) / graded.length,
          )
        : 60;

      const [scoreResponse, overallFeedbackResponse] = await Promise.all([
        groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
          messages: [
            {
              role: "user",
              content: `Rate this candidate's OVERALL performance across this entire ${domain} interview on a scale of 1-100.
Consider technical accuracy, communication, and problem-solving across ALL their answers, not just the most recent one.
As a reference point, their answers were graded per-question as follows: ${graded
                .map((m) => m.evaluation)
                .join(", ")}.

Full transcript:
${transcript}

Return ONLY a number between 10-100, nothing else.`,
            },
          ],
          temperature: 0.5,
          max_tokens: 20,
        }),
        groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
          messages: [
            {
              role: "user",
              content: `Summarize this candidate's overall performance across this ${domain} interview in 2-3 sentences, covering strengths and the biggest area to improve.

Full transcript:
${transcript}

Return ONLY the summary, no additional text.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      ]);

      const scoreRaw = scoreResponse.choices[0].message.content.trim();
      const numMatch = scoreRaw.match(/\d+/);
      const parsed = numMatch ? parseInt(numMatch[0]) : NaN;
      // Blend the LLM's holistic read with the deterministic baseline so a
      // single erratic model response can't swing the score wildly.
      const llmScore = Number.isFinite(parsed) ? parsed : baselineScore;
      const score = Math.max(
        10,
        Math.min(100, Math.round((llmScore + baselineScore) / 2)),
      );

      const overallFeedback = overallFeedbackResponse.choices[0].message.content.trim();

      interview.score = score;
      interview.isComplete = true;
      interview.feedback = overallFeedback;
      interview.duration = Math.max(
        1,
        Math.round((Date.now() - interview.createdAt.getTime()) / 60000),
      );

      await interview.save();

      return res.json({ feedback: overallFeedback, score, isComplete: true });
    }

    // ── Continue path ──────────────────────────────────────
    // interview.questionsAnswered was just incremented above, and equals the
    // number of AI questions asked so far (first question preceded any
    // answer, so counts stay in lockstep). The question we're about to
    // generate will be number (questionsAnswered + 1) overall.
    const nextQuestionNumber = interview.questionsAnswered + 1;
    const nextIsCoding = CODING_QUESTION_NUMBERS.includes(nextQuestionNumber);

    // If the candidate got it wrong, don't dig deeper into a topic they don't
    // know — switch to a fresh, general ${domain} question instead.
    let nextQuestionPrompt;
    if (nextIsCoding) {
      nextQuestionPrompt = `You are an expert ${domain} interviewer. Generate a CODING challenge question for a ${domain} technical interview.
Requirements:
- State the problem clearly with a concrete example input and expected output
- Solvable in a reasonable amount of code (not a huge system-design problem)
- Do NOT include the solution or any hints toward the answer
- The candidate will type their solution as code, so phrase it like a coding-interview prompt ("Write a function that...")

Return ONLY the question, nothing else.`;
    } else if (evaluation === "incorrect") {
      nextQuestionPrompt = `You are an expert ${domain} interviewer. The candidate got the previous question wrong.
Ask a NEW general ${domain} interview question on a DIFFERENT topic/subtopic than the previous one — don't build on the wrong answer.
Keep it foundational rather than advanced, open-ended, and professional.

Return ONLY the new question, nothing else.`;
    } else {
      nextQuestionPrompt = `You are an expert ${domain} interviewer. Generate the NEXT interview question based on the previous answer.
The question should:
- Be different from typical generic interview questions
- Build on topics relevant to ${domain}
- Be open-ended and professional
- Test deeper understanding of the domain

Previous answer context: "${answer.substring(0, 100)}..."

Return ONLY the new question, nothing else.`;
    }

    const nextQuestionResponse = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      messages: [{ role: "user", content: nextQuestionPrompt }],
      temperature: 0.7,
      max_tokens: nextIsCoding ? 300 : 150,
    });

    const nextQuestion = nextQuestionResponse.choices[0].message.content.trim();
    const nextQuestionType = nextIsCoding ? "coding" : "behavioral";

    interview.messages.push({
      role: "ai",
      content: nextQuestion,
      timestamp: new Date(),
      questionType: nextQuestionType,
    });

    await interview.save();

    return res.json({
      feedback,
      nextQuestion,
      questionType: nextQuestionType,
      totalQuestions: TOTAL_QUESTIONS,
      evaluation,
      isComplete: false,
    });
  } catch (err) {
    console.error("submitAnswer error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};
// ── Get All Completed Interviews ──────────────────────────
const getInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: req.userId,
      isComplete: true,
    })
      .select("domain score duration questionsAnswered createdAt warnings terminated")
      .sort({ createdAt: -1 });

    const mapped = interviews.map((i) => ({
      id: i._id,
      topic: i.domain,
      score: i.score,
      duration: i.duration,
      date: i.createdAt,
      warningCount: i.warnings?.length || 0,
      terminated: !!i.terminated,
    }));

    res.json({ interviews: mapped });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch interviews", error: err.message });
  }
};

// ── Get Single Interview ──────────────────────────────────
const getInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });
    res.json({ interview });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── Log a proctoring warning (camera off, tab switched, etc.) ─
const logWarning = async (req, res) => {
  try {
    const { type, message = "" } = req.body;
    const allowed = ["camera_off", "tab_hidden", "no_face", "permission_denied"];
    if (!allowed.includes(type)) {
      return res.status(400).json({ message: "Invalid warning type" });
    }

    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!interview)
      return res.status(404).json({ message: "Session not found" });

    interview.warnings.push({ type, message, timestamp: new Date() });

    const shouldTerminate =
      !interview.isComplete && interview.warnings.length >= MAX_WARNINGS;

    if (shouldTerminate) {
      interview.isComplete = true;
      interview.terminated = true;
      interview.feedback =
        interview.feedback ||
        `Session auto-ended after ${MAX_WARNINGS} proctoring warnings.`;
      interview.duration = Math.max(
        1,
        Math.round((Date.now() - interview.createdAt.getTime()) / 60000),
      );
      // Score reflects only what was answered so far, never inflated
      interview.score = interview.score || 0;
    }

    await interview.save();

    res.status(201).json({
      warningCount: interview.warnings.length,
      warnings: interview.warnings,
      terminated: shouldTerminate,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to log warning", error: err.message });
  }
};

module.exports = {
  startInterview,
  submitAnswer,
  getInterviews,
  getInterview,
  logWarning,
};
