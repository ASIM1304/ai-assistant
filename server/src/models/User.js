const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const educationSchema = new mongoose.Schema(
  { degree: { type: String, maxlength: 120 }, institution: { type: String, maxlength: 120 }, year: { type: Number, min: 1950, max: 2100 } },
  { _id: false },
);
const experienceSchema = new mongoose.Schema(
  {
    title: { type: String, maxlength: 120 },
    company: { type: String, maxlength: 120 },
    years: { type: Number, min: 0, max: 60 },
    summary: { type: String, maxlength: 500 },
  },
  { _id: false },
);

/**
 * Candidate profile. Data-minimisation: only what the interview needs.
 * No date of birth, address, government ids, photos, etc.
 */
const profileSchema = new mongoose.Schema(
  {
    phone: { type: String, maxlength: 30 },
    education: { type: [educationSchema], default: [] },
    skills: { type: [{ type: String, maxlength: 60 }], default: [] },
    experience: { type: [experienceSchema], default: [] },
    selectedJobRole: { type: String, maxlength: 80 }, // JobRole.key
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 254 },
    // bcrypt hash only. `select: false` => never loaded unless explicitly requested.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["candidate"], default: "candidate", immutable: true }, // admins are a separate collection
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    profile: { type: profileSchema, default: () => ({}) },
  },
  { timestamps: true, toJSON: jsonOpts },
);

module.exports = mongoose.model("User", userSchema);
