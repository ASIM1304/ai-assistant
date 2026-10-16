/**
 * Creates (or resets the password of) an administrator in the separate `admins` collection.
 * Registration can never create admins; admins sign in at /admin/login.
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='long-strong-passphrase' npm run seed:admin
 */
const mongoose = require("mongoose");
const { config } = require("../src/config/env");
const { Admin } = require("../src/models");
const { passwordIssues, hashPassword } = require("../src/services/passwords");
const { ensureDefaults } = require("../src/services/defaults");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Administrator";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  const issues = passwordIssues(password, { email, name });
  if (issues.length) throw new Error("Weak password: " + issues.join("; "));
  await mongoose.connect(config.mongoUri);
  await ensureDefaults();
  const passwordHash = await hashPassword(password);
  const existing = await Admin.findOne({ email });
  if (existing) await Admin.updateOne({ _id: existing._id }, { $set: { passwordHash, isActive: true, failedLoginAttempts: 0, lockUntil: null } });
  else await Admin.create({ name, email, passwordHash });
  console.log(`Administrator ready: ${email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
