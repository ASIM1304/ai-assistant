const { User } = require("../models");
const { clearSessionCookie } = require("../middleware/auth");
const { verifyPassword } = require("../services/passwords");
const { deleteUserCascade, exportUserData } = require("../services/accounts");
const { resolveRole } = require("../services/interviewEngine");
const { audit } = require("../services/audit");
const { stripTags } = require("../utils/text");
const { badRequest, unauthorized } = require("../utils/AppError");
const { publicUser } = require("./auth.controller");

// Every handler works on req.user (from the session) - there is no user id in
// the URL or body, so one candidate can never address another's profile.
const getProfile = (req, res) => res.json({ user: publicUser(req.user) });

async function updateProfile(req, res) {
  const b = req.valid.body;
  const set = {};
  if (b.name !== undefined) set.name = stripTags(b.name, 100);
  if (b.phone !== undefined) set["profile.phone"] = stripTags(b.phone, 30);
  if (b.education !== undefined)
    set["profile.education"] = b.education.map((e) => ({ degree: stripTags(e.degree || "", 120), institution: stripTags(e.institution || "", 120), year: e.year }));
  if (b.skills !== undefined) {
    const seen = new Set();
    set["profile.skills"] = b.skills.map((s) => stripTags(s, 60)).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  }
  if (b.experience !== undefined)
    set["profile.experience"] = b.experience.map((e) => ({ title: stripTags(e.title || "", 120), company: stripTags(e.company || "", 120), years: e.years, summary: stripTags(e.summary || "", 500) }));
  if (b.selectedJobRole !== undefined) {
    const role = await resolveRole(b.selectedJobRole);
    if (!role) throw badRequest("Unknown job role", "INVALID_ROLE");
    set["profile.selectedJobRole"] = role.key;
  }
  await User.updateOne({ _id: req.user._id }, { $set: set });
  res.json({ user: publicUser(await User.findById(req.user._id)) });
}

async function exportData(req, res) {
  const data = await exportUserData(req.user);
  res.setHeader("Content-Disposition", 'attachment; filename="my-interview-data.json"');
  res.json(data);
}

async function deleteAccount(req, res) {
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await verifyPassword(req.valid.body.password, user.passwordHash))) throw unauthorized("Password is incorrect", "INVALID_CREDENTIALS");
  await audit(user, "account.self_delete", { type: "user", id: user.id });
  await deleteUserCascade(user._id);
  clearSessionCookie(res);
  res.json({ ok: true, message: "Your account and all associated interview data have been permanently deleted." });
}

module.exports = { getProfile, updateProfile, exportData, deleteAccount };
