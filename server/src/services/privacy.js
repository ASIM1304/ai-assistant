const { config } = require("../config/env");

const PRIVACY_VERSION = "2026-10-v1";

/** Privacy notice shown on the consent screen; retention numbers come from live settings. */
function buildPrivacyNotice(settings) {
  const r = settings.retention;
  return {
    version: PRIVACY_VERSION,
    title: "Privacy & consent",
    sections: [
      {
        heading: "What we collect",
        items: [
          "Account details: name, e-mail, and a salted hash of your password (never the password itself).",
          "Optional profile details you enter: phone, education, skills, experience, and your selected job role.",
          "Interview data: each question, your typed or spoken-then-transcribed answer, AI feedback and scores, timings, and proctoring flags.",
          "Optional resume: only the AI analysis is kept; the uploaded file itself is not stored. Job descriptions you paste are stored with that interview.",
        ],
      },
      {
        heading: "Why camera and microphone are requested",
        items: [
          "Camera: to check that a face is present in front of the screen during the interview. Face detection runs inside your browser. Your video is NOT recorded, uploaded or stored.",
          "Microphone: to check your audio works and, if you choose voice answers, to turn speech into text. Your audio is NOT recorded, uploaded or stored by us.",
          "Heads-up: voice answers use your browser's built-in speech recognition. In some browsers (for example Chrome) that service sends audio to the browser vendor (for example Google) for transcription. Prefer typed answers if you are not comfortable with that.",
        ],
      },
      {
        heading: "How your data is processed",
        items: [
          "Your selected role and interview type, optional skills/experience level, resume analysis and job description (only if you choose a resume- or job-based interview), and your questions and answers are sent to our AI provider (Groq) to generate questions, assess answers and write your report. Do not include sensitive personal information in answers or job descriptions.",
          "AI scores and feedback are automated assessments. They can be wrong or biased and are not objective facts.",
          "Proctoring events (tab switch, face not detected, etc.) are automatic flags for human review. A flag alone is not evidence of cheating.",
        ],
      },
      {
        heading: "Who can access it",
        items: [
          "You can see all of your own data.",
          "Authorised administrators can review interview reports and proctoring flags. Their access is logged. Administrators do not see your phone number, education or resume.",
          "Our AI provider processes the text described above.",
        ],
      },
      {
        heading: "How long we keep it",
        items: [
          `Interviews, reports and proctoring flags: ${r.interviewDays} days.`,
          `Resume analysis: ${r.resumeDays} days.`,
          "Audio and video: never stored.",
        ],
      },
      {
        heading: "Your choices",
        items: [
          "Export a copy of your data, or permanently delete your account and all interview data, any time from your Profile page.",
          `Questions about privacy: ${config.privacyContact}.`,
        ],
      },
    ],
  };
}

module.exports = { PRIVACY_VERSION, buildPrivacyNotice };
