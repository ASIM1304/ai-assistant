const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

/**
 * Resume metadata + AI analysis. The original file and raw extracted text are
 * NOT stored (data minimisation) - only the structured analysis the candidate
 * saw. One active resume per candidate.
 */
const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fileName: { type: String, maxlength: 200 },
    mimeType: { type: String, maxlength: 100 },
    sizeBytes: Number,
    sha256: String,
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    aiGenerated: { type: Boolean, default: true },
    aiConsentAt: { type: Date, required: true },
  },
  { timestamps: true, toJSON: jsonOpts },
);

module.exports = mongoose.model("Resume", resumeSchema);
