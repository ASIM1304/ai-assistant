const rateLimit = require("express-rate-limit");

const handler = (_req, res) =>
  res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." } });

function limiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler,
    keyGenerator,
  });
}
const byUser = (req) => (req.user ? `u:${req.user.id}` : `ip:${req.ip}`);

/** Factory so every app instance (and every test) gets fresh counters. */
function buildLimiters(limits) {
  return {
    global: limiter({ windowMs: 15 * 60_000, max: limits.global }),
    login: limiter({ windowMs: 15 * 60_000, max: limits.login }),
    register: limiter({ windowMs: 60 * 60_000, max: limits.register }),
    passwordFlow: limiter({ windowMs: 60 * 60_000, max: limits.passwordFlow }),
    ai: limiter({ windowMs: 60_000, max: limits.ai, keyGenerator: byUser }),
    resume: limiter({ windowMs: 60 * 60_000, max: limits.resume, keyGenerator: byUser }),
  };
}

module.exports = { buildLimiters };
