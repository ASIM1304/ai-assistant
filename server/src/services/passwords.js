const bcrypt = require("bcryptjs");
const { config } = require("../config/env");

const COMMON = new Set([
  "password", "passw0rd", "p@ssw0rd", "letmein", "qwerty", "qwertyuiop", "iloveyou", "welcome", "admin", "administrator",
  "abc123", "monkey", "dragon", "football", "baseball", "master", "login", "princess", "sunshine", "trustno1",
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "changeme", "interview",
]);

/**
 * Strong-password policy. bcrypt only uses the first 72 BYTES, so we cap there
 * rather than silently truncating.
 * Returns a list of human-readable problems (empty = acceptable).
 */
function passwordIssues(password, { email = "", name = "" } = {}) {
  const issues = [];
  if (typeof password !== "string") return ["Password is required"];
  if (password.length < 10) issues.push("Use at least 10 characters");
  if (Buffer.byteLength(password, "utf8") > 72) issues.push("Use at most 72 bytes (about 72 characters)");
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) issues.push("Mix at least three of: lowercase, uppercase, numbers, symbols");
  const squashed = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if ([...COMMON].some((c) => squashed === c || (c.length >= 6 && squashed.includes(c) && squashed.length <= c.length + 6))) {
    issues.push("This password is too common");
  }
  if (/(.)\1{4,}/.test(password)) issues.push("Avoid long runs of the same character");
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) issues.push("Password must not contain your e-mail name");
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && password.toLowerCase().includes(first)) issues.push("Password must not contain your name");
  return issues;
}

const hashPassword = (pw) => bcrypt.hash(pw, config.bcryptCost);
const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

// Used to keep login timing similar whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", config.bcryptCost);
const burnTime = (pw) => bcrypt.compare(String(pw ?? ""), DUMMY_HASH);

module.exports = { passwordIssues, hashPassword, verifyPassword, burnTime };
