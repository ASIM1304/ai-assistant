/**
 * Proctoring policy. Events are FLAGS for human review, never verdicts.
 * Severity and "counts toward limit" come from the admin-configured policy,
 * never from the client.
 */
const DESCRIPTIONS = {
  TAB_SWITCH: "Interview tab was hidden or the candidate switched to another window.",
  FULLSCREEN_EXIT: "Fullscreen mode was exited.",
  CAMERA_DISABLED: "Camera stream stopped or was disabled.",
  MICROPHONE_DISABLED: "Microphone stream stopped or was muted.",
  FACE_NOT_DETECTED: "No face was detected in the camera frame for an extended period.",
  MULTIPLE_FACES: "More than one face was detected in the camera frame.",
  INACTIVITY: "No keyboard, mouse, touch or voice activity for an extended period.",
  PERMISSION_DENIED: "Camera/microphone permission was denied or revoked.",
  CONNECTION_LOST: "The browser stopped reporting to the server for a period (network issue or closed tab).",
  PROMPT_INJECTION_SUSPECTED: "The answer contained text that looks like an attempt to instruct the AI evaluator.",
};

function classify(type, durationSeconds, proctoring) {
  const rule = proctoring.events?.[type];
  if (!rule || !rule.enabled) return null; // disabled => ignore the event entirely
  let { severity, countsTowardLimit } = rule;
  if (type === "TAB_SWITCH" && durationSeconds < (proctoring.minTabSwitchSeconds || 0)) {
    severity = "info";
    countsTowardLimit = false; // too brief to be meaningful
  }
  return { severity, countsTowardLimit };
}

/** What should happen after `count` counted warnings? */
function levelFor(count, limits) {
  const { notifyUntil = 2, reviewAt = 3, terminateAt = 0 } = limits || {};
  if (terminateAt > 0 && count >= terminateAt) return "terminate";
  if (count >= reviewAt) return "review";
  if (count >= 1 && count <= Math.max(notifyUntil, reviewAt - 1)) return "notify";
  return "none";
}

const MESSAGES = {
  none: "",
  notify: "Please keep this window in focus and your camera unobstructed. This was recorded as a flag.",
  review: "Several flags have been recorded. This interview will be reviewed by an administrator.",
  terminate: "The configured flag limit was reached, so this interview has ended. It will be reviewed by an administrator.",
};

function summarizeEvents(events) {
  const byType = {};
  let counted = 0;
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    if (e.countsTowardLimit) counted++;
  }
  return {
    total: events.length,
    countedFlags: counted,
    byType,
    note: "Security events are automated flags, not proof of misconduct. They can be caused by lighting, hardware, notifications or network problems.",
  };
}

module.exports = { DESCRIPTIONS, classify, levelFor, MESSAGES, summarizeEvents };
