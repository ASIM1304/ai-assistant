/**
 * Central configuration. Everything that varies per environment comes from
 * process.env here, so secrets never live in source control.
 * Call validateEnv() at startup: in production it refuses to boot with an
 * unsafe configuration (missing/weak secret, wildcard CORS, ...).
 */
require("dotenv").config({ quiet: true });

const env = process.env.NODE_ENV || "development";
const isProd = env === "production";
const isTest = env === "test";

const list = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const bool = (v, dflt) =>
  v === undefined || v === "" ? dflt : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
const int = (v, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
};

const corsOrigins = list(process.env.CORS_ORIGINS);
if (!corsOrigins.length && !isProd) corsOrigins.push("http://localhost:3000");

let sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(sameSite)) sameSite = "lax";

const config = {
  env,
  isProd,
  isTest,
  port: int(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins,
  frontendUrl: process.env.FRONTEND_URL || corsOrigins[0] || "http://localhost:3000",
  trustProxy: process.env.TRUST_PROXY ? int(process.env.TRUST_PROXY, 1) : false,

  session: {
    absoluteHours: int(process.env.SESSION_HOURS, 8),
    idleMinutes: int(process.env.SESSION_IDLE_MINUTES, 60),
  },
  cookie: {
    name: "sid",
    // SameSite=None (needed only when API and frontend are on different sites)
    // requires Secure.
    sameSite,
    secure: isProd || sameSite === "none",
  },

  bcryptCost: isTest ? 4 : int(process.env.BCRYPT_COST, 12),
  lockout: {
    maxFailures: int(process.env.LOGIN_MAX_FAILURES, 5),
    lockMinutes: int(process.env.LOGIN_LOCK_MINUTES, 15),
  },
  requireEmailVerification: bool(process.env.REQUIRE_EMAIL_VERIFICATION, isProd),

  rateLimits: {
    global: int(process.env.RL_GLOBAL_MAX, isTest ? 100000 : 300),
    login: int(process.env.RL_LOGIN_MAX, isTest ? 100000 : 10),
    register: int(process.env.RL_REGISTER_MAX, isTest ? 100000 : 10),
    passwordFlow: int(process.env.RL_PASSWORD_MAX, isTest ? 100000 : 6),
    ai: int(process.env.RL_AI_MAX_PER_MIN, isTest ? 100000 : 30),
    resume: int(process.env.RL_RESUME_MAX_PER_HOUR, isTest ? 100000 : 6),
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    timeoutMs: int(process.env.GROQ_TIMEOUT_MS, 30000),
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || "AI Interview <no-reply@example.com>",
  },

  privacyContact: process.env.PRIVACY_CONTACT_EMAIL || "privacy@example.com",
  jsonLimit: "100kb",
  maxResumeBytes: 5 * 1024 * 1024,
};

function validateEnv() {
  const problems = [];
  if (!config.mongoUri) problems.push("MONGO_URI is not set");
  if (!config.jwtSecret || config.jwtSecret.length < 32)
    problems.push("JWT_SECRET must be set and at least 32 characters (try: openssl rand -hex 48)");
  if (isProd) {
    if (!corsOrigins.length) problems.push("CORS_ORIGINS must list the exact frontend origin(s) in production");
    if (corsOrigins.some((o) => o === "*" || !/^https:\/\//.test(o)))
      problems.push("CORS_ORIGINS must not contain '*' and must be https:// origins in production");
    if (!config.groq.apiKey) problems.push("GROQ_API_KEY is not set");
    if (config.requireEmailVerification && !config.smtp.host)
      problems.push("SMTP_HOST must be configured when email verification is required");
  } else if (!config.groq.apiKey) {
    console.warn("[config] GROQ_API_KEY is not set - AI features will return 503 until it is.");
  }
  if (problems.length) {
    const msg = "Invalid configuration:\n - " + problems.join("\n - ");
    const err = new Error(msg);
    err.isConfigError = true;
    throw err;
  }
}

module.exports = { config, validateEnv };
