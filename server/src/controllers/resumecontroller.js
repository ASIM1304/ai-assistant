const Groq = require("groq-sdk");
const pdfjslib = require("pdfjs-dist/legacy/build/pdf.js");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DOMAINS = [
  "JavaScript/Node.js",
  "React",
  "Python",
  "Data Science",
  "DevOps",
  "System Design",
  "Database Design",
  "General",
];

async function extractTextFromPDF(buffer) {
  const uint8Array = new Uint8Array(buffer);

  const loadingTask = pdfjslib.getDocument({
    data: uint8Array,
  });

  const pdf = await loadingTask.promise;

  let textContent = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const content = await page.getTextContent();

    const strings = content.items.map((item) => item.str);

    textContent += strings.join(" ") + "\n";
  }

  return textContent;
}

const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    let resumeText = "";

    if (req.file.mimetype === "application/pdf") {
      resumeText = await extractTextFromPDF(req.file.buffer);
    } else {
      resumeText = req.file.buffer.toString("utf-8");
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        error: "Failed to extract text from resume",
      });
    }

    const truncatedResume = resumeText.slice(0, 6000);

    const prompt = `
You are an expert AI Technical Recruiter and Career Coach.

Analyze the resume carefully.

Return ONLY valid JSON.

Available Interview Domains:
${DOMAINS.join(", ")}

Resume:

"""
${truncatedResume}
"""

Return JSON exactly like this:

{
  "summary":"Professional summary",

  "experienceLevel":"Fresher",

  "education":"Highest Qualification",

  "skillsDetected":[
    "React",
    "Node.js"
  ],

  "projects":[
    "Project 1",
    "Project 2"
  ],

  "certifications":[
    "Certification 1"
  ],

  "strengths":[
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],

  "weaknesses":[
    "Weakness 1",
    "Weakness 2"
  ],

  "resumeScore":90,

  "recommendedCompanies":[
    "Google",
    "Microsoft",
    "Amazon"
  ],

  "recommendedRoles":[
    "Frontend Developer",
    "Full Stack Developer"
  ],

  "recommendedDomains":[
    {
      "label":"React",
      "reason":"Candidate has strong React skills",
      "confidence":95
    }
  ]
}

Rules

Return ONLY JSON.

experienceLevel must be one of

Fresher

Junior

Mid

Senior

resumeScore must be between 0-100.

Maximum 15 skills.

Maximum 5 projects.

Maximum 5 certifications.

Maximum 5 companies.

Maximum 5 roles.

recommendedDomains label MUST match one of:

${DOMAINS.join(", ")}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const raw =
      completion.choices[0].message.content || "{}";

    let analysis = {};

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);

      analysis = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : {};
    } catch (error) {
      return res.status(500).json({
        error: "Failed to parse AI response",
      });
    }

    analysis.summary =
      analysis.summary || "";

    analysis.education =
      analysis.education || "";

    analysis.experienceLevel =
      analysis.experienceLevel || "Fresher";

    analysis.resumeScore =
      analysis.resumeScore || 0;

    analysis.skillsDetected =
      analysis.skillsDetected || [];

    analysis.projects =
      analysis.projects || [];

    analysis.certifications =
      analysis.certifications || [];

    analysis.strengths =
      analysis.strengths || [];

    analysis.weaknesses =
      analysis.weaknesses || [];

    analysis.recommendedCompanies =
      analysis.recommendedCompanies || [];

    analysis.recommendedRoles =
      analysis.recommendedRoles || [];

    analysis.recommendedDomains =
      analysis.recommendedDomains || [];

    analysis.recommendedDomains =
      analysis.recommendedDomains.filter((item) =>
        DOMAINS.includes(item.label)
      );

    const interviewData = {
      company:
        analysis.recommendedCompanies[0] || "General",

      role:
        analysis.recommendedRoles[0] ||
        "Software Engineer",

      experience:
        analysis.experienceLevel,

      skills:
        analysis.skillsDetected,

      resumeScore:
        analysis.resumeScore,

      domain:
        analysis.recommendedDomains.length > 0
          ? analysis.recommendedDomains[0].label
          : "General",
    };

    return res.json({
      success: true,
      analysis,
      interviewData,
    });
  } catch (error) {
    console.error("Resume Analysis Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

module.exports = {
  analyzeResume,
};