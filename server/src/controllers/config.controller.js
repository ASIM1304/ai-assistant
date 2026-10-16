const { JobRole } = require("../models");
const { getSettings } = require("../services/settings");
const { buildPrivacyNotice } = require("../services/privacy");

const privacy = async (_req, res) => res.json(buildPrivacyNotice(await getSettings()));

async function roles(_req, res) {
  const [list, s] = await Promise.all([JobRole.find({ active: true }).sort({ sortOrder: 1, label: 1 }), getSettings()]);
  res.json({
    roles: list.map((r) => ({ key: r.key, label: r.label, description: r.description, categories: r.categories })),
    interviewDefaults: {
      totalQuestions: s.interview.totalQuestions,
      durationMinutes: s.interview.durationMinutes,
      maxSkips: s.interview.maxSkips,
      limits: s.interview.limits,
      interviewTypes: ["technical", "behavioral", "hr", "resume", "job_description"],
      startDifficulty: s.interview.startDifficulty,
      proctoringEnabled: s.proctoring.enabled,
      requireCamera: s.proctoring.requireCamera,
      requireMicrophone: s.proctoring.requireMicrophone,
      requireFullscreen: s.proctoring.requireFullscreen,
    },
  });
}

module.exports = { privacy, roles };
