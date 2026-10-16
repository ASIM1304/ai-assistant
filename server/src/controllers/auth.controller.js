const crypto = require("crypto");
const { config } = require("../config/env");
const { User, Admin, Session, AuthToken } = require("../models");
const { createSession, clearSessionCookie, revokeAllSessions } = require("../middleware/auth");
const { passwordIssues, hashPassword, verifyPassword, burnTime } = require("../services/passwords");
const { sendMail } = require("../services/mailer");
const { audit } = require("../services/audit");
const { badRequest, unauthorized, forbidden, conflict, tooMany } = require("../utils/AppError");
const { stripTags } = require("../utils/text");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
  profile: u.profile,
});

function assertStrongPassword(password, user) {
  const issues = passwordIssues(password, user);
  if (issues.length) throw badRequest("Password is not strong enough", "WEAK_PASSWORD", { fields: [{ field: "password", message: issues.join(". ") }], issues });
}

async function issueToken(user, type, ttlMs) {
  await AuthToken.deleteMany({ userId: user._id, type }); // only the newest link works
  const raw = crypto.randomBytes(32).toString("hex");
  await AuthToken.create({ userId: user._id, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function consumeToken(raw, type) {
  const tok = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(String(raw)), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!tok) throw badRequest("This link is invalid or has expired.", "INVALID_TOKEN");
  return tok;
}

const sendVerification = async (user) => {
  const token = await issueToken(user, "verify_email", 24 * 3600_000);
  await sendMail({
    to: user.email,
    subject: "Verify your e-mail address",
    text: `Hi ${user.name},\n\nConfirm your e-mail to activate your account:\n${config.frontendUrl}/verify-email?token=${token}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this message.`,
  });
};

// ── handlers ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password } = req.valid.body;
  assertStrongPassword(password, { email, name });

  const exists = await User.findOne({ email });
  if (exists) {
    // With verification on we answer identically for new and existing e-mails
    // (no account enumeration). Without it, say so plainly for usability.
    if (config.requireEmailVerification) return res.status(202).json({ verificationRequired: true, message: "If this e-mail can be registered, a verification link has been sent." });
    throw conflict("Email already in use", "EMAIL_IN_USE");
  }

  // `role` is never read from the request - registration always creates a candidate.
  const user = await User.create({ name: stripTags(name, 100), email, passwordHash: await hashPassword(password), role: "candidate", emailVerified: false, passwordChangedAt: new Date() });
  await audit(user, "auth.register", { type: "user", id: user.id });

  if (config.requireEmailVerification) {
    await sendVerification(user);
    return res.status(202).json({ verificationRequired: true, message: "If this e-mail can be registered, a verification link has been sent." });
  }
  const { csrfToken } = await createSession(res, user);
  res.status(201).json({ user: publicUser(user), csrfToken });
}

async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    await burnTime(password); // similar timing whether or not the account exists
    throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw tooMany("Too many failed sign-in attempts. Please try again later.", "ACCOUNT_LOCKED");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await User.updateOne({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } }); // atomic increment
    const updated = await User.findById(user._id).select("failedLoginAttempts");
    if (updated.failedLoginAttempts >= config.lockout.maxFailures) {
      await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + config.lockout.lockMinutes * 60_000), failedLoginAttempts: 0 } });
      await audit(user, "auth.lockout", { type: "user", id: user.id });
    }
    throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }
  // Only after the password is proven do we reveal account state.
  if (!user.isActive) throw forbidden("This account has been disabled. Contact support.", "ACCOUNT_DISABLED");
  if (config.requireEmailVerification && !user.emailVerified) throw forbidden("Please verify your e-mail address before signing in.", "EMAIL_NOT_VERIFIED");

  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() } });
  const { csrfToken } = await createSession(res, user);
  await audit(user, "auth.login", { type: "user", id: user.id });
  res.json({ user: publicUser(user), csrfToken });
}

async function logout(req, res) {
  await Session.updateOne({ _id: req.session._id }, { $set: { revokedAt: new Date() } });
  clearSessionCookie(res);
  res.json({ ok: true });
}

const me = (req, res) => res.json({ user: publicUser(req.user), csrfToken: req.session.csrfToken });

async function verifyEmail(req, res) {
  const tok = await consumeToken(req.valid.body.token, "verify_email");
  await User.updateOne({ _id: tok.userId }, { $set: { emailVerified: true } });
  res.json({ ok: true, message: "E-mail verified. You can now sign in." });
}

const GENERIC = { message: "If an account exists for that address, an e-mail has been sent." };

async function resendVerification(req, res) {
  const user = await User.findOne({ email: req.valid.body.email });
  if (user && !user.emailVerified && user.isActive) await sendVerification(user);
  res.status(202).json(GENERIC);
}

async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.valid.body.email });
  if (user && user.isActive) {
    const token = await issueToken(user, "reset_password", 3600_000);
    await sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${config.frontendUrl}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this e-mail - your password has not changed.`,
    });
  }
  res.status(202).json(GENERIC);
}

async function resetPassword(req, res) {
  const { token, password } = req.valid.body;
  // Look the token up first, so a too-weak password doesn't burn the single-use link.
  const pending = await AuthToken.findOne({ tokenHash: sha256(String(token)), type: "reset_password", usedAt: null, expiresAt: { $gt: new Date() } });
  const user = pending && (await User.findById(pending.userId));
  if (!user) throw badRequest("This link is invalid or has expired.", "INVALID_TOKEN");
  assertStrongPassword(password, user);
  await consumeToken(token, "reset_password");
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginAttempts: 0, lockUntil: null } });
  await revokeAllSessions(user._id); // any stolen/old session dies with the old password
  await audit(user, "auth.password_reset", { type: "user", id: user.id });
  res.json({ ok: true, message: "Password updated. Please sign in." });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw unauthorized("Current password is incorrect", "INVALID_CREDENTIALS");
  assertStrongPassword(newPassword, user);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() } });
  await revokeAllSessions(user._id, req.session.jti);
  await audit(user, "auth.password_change", { type: "user", id: user.id });
  res.json({ ok: true });
}

// ── administrators: separate collection, separate login, no registration ──
const publicAdmin = (a) => ({ id: a.id, name: a.name, email: a.email, role: "admin" });

async function adminLogin(req, res) {
  const { email, password } = req.valid.body;
  const admin = await Admin.findOne({ email }).select("+passwordHash");
  if (!admin) {
    await burnTime(password);
    throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }
  if (admin.lockUntil && admin.lockUntil.getTime() > Date.now()) throw tooMany("Too many failed sign-in attempts. Please try again later.", "ACCOUNT_LOCKED");
  if (!(await verifyPassword(password, admin.passwordHash))) {
    await Admin.updateOne({ _id: admin._id }, { $inc: { failedLoginAttempts: 1 } });
    const u = await Admin.findById(admin._id).select("failedLoginAttempts");
    if (u.failedLoginAttempts >= config.lockout.maxFailures) await Admin.updateOne({ _id: admin._id }, { $set: { lockUntil: new Date(Date.now() + config.lockout.lockMinutes * 60_000), failedLoginAttempts: 0 } });
    throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }
  if (!admin.isActive) throw forbidden("This account has been disabled.", "ACCOUNT_DISABLED");
  await Admin.updateOne({ _id: admin._id }, { $set: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() } });
  const { csrfToken } = await createSession(res, admin, "admin");
  await audit(admin, "admin.login", { type: "admin", id: admin.id });
  res.json({ admin: publicAdmin(admin), csrfToken });
}
async function adminLogout(req, res) {
  await Session.updateOne({ _id: req.session._id }, { $set: { revokedAt: new Date() } });
  clearSessionCookie(res, "admin");
  res.json({ ok: true });
}
const adminMe = (req, res) => res.json({ admin: publicAdmin(req.user), csrfToken: req.session.csrfToken });

module.exports = { adminLogin, adminLogout, adminMe, register, login, logout, me, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, publicUser };
