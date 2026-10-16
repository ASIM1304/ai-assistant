const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config/env");
const { User, Admin, Session } = require("../models");
const { unauthorized, forbidden } = require("../utils/AppError");

// Separate cookies: a candidate session can never be presented as an admin session.
const COOKIES = { user: config.cookie.name, admin: "asid" };
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true, // JS (and therefore XSS) cannot read the session token
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: "/",
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

async function createSession(res, user, principal = "user") {
  const jti = crypto.randomBytes(24).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const ttlMs = config.session.absoluteHours * 3600_000;
  await Session.create({ userId: user._id, principal, jti, csrfToken, expiresAt: new Date(Date.now() + ttlMs) });
  const token = jwt.sign({ sub: user.id, jti, p: principal }, config.jwtSecret, { algorithm: "HS256", expiresIn: `${config.session.absoluteHours}h` });
  res.cookie(COOKIES[principal], token, cookieOptions(ttlMs));
  return { csrfToken };
}

const clearSessionCookie = (res, principal = "user") => res.clearCookie(COOKIES[principal], cookieOptions());

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a || ""));
  const B = Buffer.from(String(b || ""));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

/**
 * Authenticates the request from the httpOnly cookie, checks the server-side
 * session (revocation, absolute + idle expiry), loads the user, and enforces
 * a per-session CSRF token on every state-changing request.
 */
const makeProtect = (principal) => async function protect(req, res, next) {
  try {
    const token = req.cookies?.[COOKIES[principal]];
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    } catch (err) {
      clearSessionCookie(res, principal);
      throw unauthorized(err.name === "TokenExpiredError" ? "Your session has expired. Please sign in again." : "Invalid session", "SESSION_EXPIRED");
    }

    if (payload.p !== principal) throw unauthorized("Invalid session", "UNAUTHENTICATED");
    const session = await Session.findOne({ jti: String(payload.jti), userId: payload.sub, principal, revokedAt: null });
    const now = Date.now();
    const idleMs = config.session.idleMinutes * 60_000;
    if (!session || session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > idleMs) {
      if (session && !session.revokedAt) await Session.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
      clearSessionCookie(res, principal);
      throw unauthorized("Your session has expired. Please sign in again.", "SESSION_EXPIRED");
    }

    const user = await (principal === "admin" ? Admin : User).findById(payload.sub);
    if (!user || !user.isActive) {
      clearSessionCookie(res, principal);
      throw unauthorized("Account unavailable", "UNAUTHENTICATED");
    }

    if (!SAFE_METHODS.has(req.method) && !safeEqual(req.get("x-csrf-token"), session.csrfToken))
      throw forbidden("Missing or invalid CSRF token", "CSRF_INVALID");

    if (now - session.lastSeenAt.getTime() > 60_000) await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now) } });

    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};

const revokeAllSessions = (userId, exceptJti) =>
  Session.updateMany({ userId, revokedAt: null, ...(exceptJti ? { jti: { $ne: exceptJti } } : {}) }, { $set: { revokedAt: new Date() } });

const protect = makeProtect("user");
const protectAdmin = makeProtect("admin");

module.exports = { protect, protectAdmin, requireRole, createSession, clearSessionCookie, revokeAllSessions };
