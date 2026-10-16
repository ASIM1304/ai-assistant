const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

/** System activity log. Deliberately stores no IP addresses or message content. */
const auditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorRole: String,
    action: { type: String, required: true, maxlength: 80 },
    targetType: String,
    targetId: String,
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonOpts },
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditSchema);
