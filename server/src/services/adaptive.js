/**
 * Adaptive difficulty - based on a WINDOW of recent evaluations, not one score.
 *
 * `scores` = the candidate's latest reliable scores at the CURRENT difficulty,
 * oldest first (the engine resets the window whenever difficulty changes).
 *
 *   - Weighted average of the last <=3 scores (newest counts most).
 *   - Move needs >= 2 scores to agree, unless the latest score is extreme
 *     (>= 92 up / <= 20 down), so one odd score can't swing the interview.
 *   easy   -> medium  avg >= 70        medium -> easy  avg < 45
 *   medium -> hard    avg >= 82        hard   -> medium avg < 50
 *
 * Unreliable evaluations (AI failed / low confidence) never reach this function.
 */
const LEVELS = ["easy", "medium", "hard"];
const idx = (l) => Math.max(0, LEVELS.indexOf(l));

const UP_AT = { easy: 70, medium: 82 };
const DOWN_BELOW = { medium: 45, hard: 50 };
const EXTREME_UP = 92;
const EXTREME_DOWN = 20;
const WEIGHTS = { 1: [1], 2: [0.4, 0.6], 3: [0.2, 0.3, 0.5] };

function bandFor(score) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 45) return "fair";
  return "poor";
}

function clampLevel(level, min = "easy", max = "hard") {
  return LEVELS[Math.min(idx(max), Math.max(idx(min), idx(level)))];
}

function weightedRecent(scores) {
  const recent = scores.slice(-3);
  if (!recent.length) return { avg: null, n: 0, latest: null };
  const w = WEIGHTS[recent.length];
  return { avg: recent.reduce((a, s, i) => a + s * w[i], 0), n: recent.length, latest: recent[recent.length - 1] };
}

function nextDifficulty({ current, scores = [], adaptive = true, min = "easy", max = "hard", reliable = true }) {
  const cur = clampLevel(current, min, max);
  if (!adaptive || !reliable || !scores.length) return cur;
  const { avg, n, latest } = weightedRecent(scores);
  let next = cur;
  if (UP_AT[cur] !== undefined && ((n >= 2 && avg >= UP_AT[cur]) || latest >= EXTREME_UP)) next = LEVELS[idx(cur) + 1];
  else if (DOWN_BELOW[cur] !== undefined && ((n >= 2 && avg < DOWN_BELOW[cur]) || latest <= EXTREME_DOWN)) next = LEVELS[idx(cur) - 1];
  return clampLevel(next, min, max);
}

module.exports = { LEVELS, bandFor, nextDifficulty, clampLevel, weightedRecent };
