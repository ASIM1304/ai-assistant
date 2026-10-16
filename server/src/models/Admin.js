const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

/**
 * Administrators live in their OWN collection, completely separate from
 * candidates: separate login endpoint, separate session cookie, no
 * registration route. A candidate session can never act as an admin and vice versa.
 */
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: "admin", immutable: true },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: Date,
  },
  { timestamps: true, toJSON: jsonOpts },
);

module.exports = mongoose.model("Admin", adminSchema);
