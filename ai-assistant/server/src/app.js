const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { config } = require("./config/env");
const requestId = require("./middleware/requestId");
const { noSqlGuard, requireJsonBody } = require("./middleware/security");
const { buildLimiters } = require("./middleware/rateLimit");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

function createApp({ rateLimits } = {}) {
  const app = express();
  const rl = buildLimiters({ ...config.rateLimits, ...(rateLimits || {}) });

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(requestId);
  app.use(
    helmet({
      // This server only returns JSON; lock everything down.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
      hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  // CORS: an explicit allow-list (never "*"), with credentials for the session cookie.
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, false); // non-browser clients: no CORS headers needed
        cb(null, config.corsOrigins.includes(origin) ? origin : false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      maxAge: 600,
    }),
  );

  app.use(rl.global);
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(cookieParser());
  app.use(requireJsonBody);
  app.use(noSqlGuard);
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store"); // API responses contain personal data
    next();
  });

  app.get("/", (_req, res) => res.json({ status: "ok" }));
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", require("./routes/auth")(rl));
  app.use("/api/profile", require("./routes/profile"));
  app.use("/api/config", require("./routes/config"));
  app.use("/api/resume", require("./routes/resume")(rl));
  app.use("/api/interviews", require("./routes/interview")(rl));
  app.use("/api/admin", require("./routes/admin")(rl));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
