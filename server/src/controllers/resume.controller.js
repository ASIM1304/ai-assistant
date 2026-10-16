const crypto = require("crypto");
const { Resume, User, JobRole } = require("../models");
const { extractResumeText } = require("../services/resumeParser");
const { matchSkills } = require("../services/matching");
const ai = require("../services/ai");
const { badRequest } = require("../utils/AppError");
const { stripTags } = require("../utils/text");

async function analyze(req, res) {
  if (!req.file) throw badRequest("No file uploaded", "NO_FILE");
  if (String(req.body?.aiConsent) !== "true")
    throw badRequest("Please confirm you agree to your resume text being analysed by our AI provider.", "CONSENT_REQUIRED");

  const text = await extractResumeText(req.file);
  const domains = (await JobRole.find({ active: true }).lean()).map((r) => r.label);
  const analysis = await ai.analyzeResume({ text, domains }); // AIUnavailableError -> 503 via error handler

  const resume = await Resume.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        fileName: stripTags(req.file.originalname || "resume", 200),
        mimeType: String(req.file.mimetype).slice(0, 100),
        sizeBytes: req.file.size,
        sha256: crypto.createHash("sha256").update(req.file.buffer).digest("hex"),
        analysis,
        aiGenerated: true,
        aiConsentAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  await User.updateOne({ _id: req.user._id }, { $set: { "profile.resumeId": resume._id } });
  res.json({
    analysis,
    resumeId: resume.id,
    aiGenerated: true,
    note: "AI-generated analysis. It may misread or omit information; please check it.",
  });
}

async function getMine(req, res) {
  const r = await Resume.findOne({ userId: req.user._id });
  res.json({ resume: r ? { id: r.id, fileName: r.fileName, analysis: r.analysis, uploadedAt: r.createdAt, aiGenerated: true } : null });
}

async function removeMine(req, res) {
  await Resume.deleteMany({ userId: req.user._id });
  await User.updateOne({ _id: req.user._id }, { $unset: { "profile.resumeId": "" } });
  res.json({ ok: true });
}

/** Compare the saved resume analysis with a pasted job description. Skills only match if literally present in both. */
async function match(req, res) {
  const resume = await Resume.findOne({ userId: req.user._id }).lean();
  if (!resume?.analysis) throw badRequest("Upload and analyse your resume first.", "RESUME_REQUIRED");
  const job = await ai.analyzeJobDescription({ text: req.valid.body.jobDescription });
  const a = resume.analysis;
  const result = matchSkills([...(a.skillsDetected || []), ...(a.technologies || [])], job.requiredSkills);
  res.json({
    job: { title: job.title, seniority: job.seniority, requiredSkills: job.requiredSkills, niceToHave: job.niceToHave, responsibilities: job.responsibilities },
    match: result,
    aiGenerated: true,
    note: "Skills listed on a resume are claims, not verified abilities. A missing skill may simply be worded differently; treat this as a starting point.",
  });
}

module.exports = { analyze, getMine, removeMine, match };
