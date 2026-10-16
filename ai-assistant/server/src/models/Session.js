const mongoose = require("mongoose");

/** Server-side session record: lets us log out / revoke / expire JWTs. */
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    principal: { type: String, enum: ["user", "admin"], default: "user" },
    jti: { type: String, required: true, unique: true },
    csrfToken: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Session", sessionSchema);
