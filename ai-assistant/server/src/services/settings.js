const { Settings } = require("../models");
const { EVENT_TYPES } = require("../models/SecurityEvent");

/** Defaults for every admin-configurable setting. */
const DEFAULT_SETTINGS = {
  interview: {
    totalQuestions: 10,
    durationMinutes: 45,
    startDifficulty: "easy",
    adaptive: true,
    minDifficulty: "easy",
    maxDifficulty: "hard",
    codingQuestionNumbers: [4, 8],
    maxSkips: 3,
    minAnswerChars: 20,
    abandonAfterMinutes: 30,
    unstartedExpireHours: 24,
    followUps: true, // ask a follow-up when an answer left a gap (max ~30% of questions)
    // Bounds for what a candidate may choose when starting an interview.
    limits: { minQuestions: 3, maxQuestions: 20, minDurationMinutes: 10, maxDurationMinutes: 90 },
  },
  proctoring: {
    enabled: true,
    requireCamera: true,
    requireMicrophone: true,
    requireFullscreen: false,
    inactivitySeconds: 180,
    minTabSwitchSeconds: 0,
    // Warning ladder (counts only events that count toward the limit):
    //   1..notifyUntil  -> notify candidate
    //   >= reviewAt     -> flag interview for admin review
    //   >= terminateAt  -> end interview (0 disables auto-termination)
    warningLimits: { notifyUntil: 2, reviewAt: 3, terminateAt: 5 },
    events: {
      TAB_SWITCH: { enabled: true, severity: "warning", countsTowardLimit: true },
      FULLSCREEN_EXIT: { enabled: true, severity: "warning", countsTowardLimit: true },
      CAMERA_DISABLED: { enabled: true, severity: "critical", countsTowardLimit: true },
      MICROPHONE_DISABLED: { enabled: true, severity: "warning", countsTowardLimit: true },
      FACE_NOT_DETECTED: { enabled: true, severity: "warning", countsTowardLimit: true },
      MULTIPLE_FACES: { enabled: true, severity: "critical", countsTowardLimit: true },
      INACTIVITY: { enabled: true, severity: "info", countsTowardLimit: false },
      PERMISSION_DENIED: { enabled: true, severity: "critical", countsTowardLimit: true },
      CONNECTION_LOST: { enabled: true, severity: "info", countsTowardLimit: false },
      PROMPT_INJECTION_SUSPECTED: { enabled: true, severity: "info", countsTowardLimit: false },
    },
  },
  retention: {
    interviewDays: 365, // interviews + questions + reports + security events
    resumeDays: 90,
    auditLogDays: 365,
    unverifiedAccountDays: 14,
  },
};

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isPlain(v) && isPlain(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

let cache = null;
let cacheAt = 0;
const TTL_MS = 15_000;

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const doc = await Settings.findOne({ key: "global" }).lean();
  cache = deepMerge(DEFAULT_SETTINGS, doc?.values || {});
  cacheAt = Date.now();
  return cache;
}

async function updateSettings(patch) {
  const current = await getSettings({ fresh: true });
  const next = deepMerge(current, patch);
  await Settings.findOneAndUpdate({ key: "global" }, { $set: { values: next } }, { upsert: true, new: true });
  cache = null;
  return getSettings({ fresh: true });
}

const clearSettingsCache = () => {
  cache = null;
};

module.exports = { DEFAULT_SETTINGS, getSettings, updateSettings, clearSettingsCache, deepMerge, EVENT_TYPES };
