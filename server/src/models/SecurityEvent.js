const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const EVENT_TYPES = [
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "CAMERA_DISABLED",
  "MICROPHONE_DISABLED",
  "FACE_NOT_DETECTED",
  "MULTIPLE_FACES",
  "INACTIVITY",
  "PERMISSION_DENIED",
  "CONNECTION_LOST",
  "PROMPT_INJECTION_SUSPECTED",
];

const securityEventSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    timestamp: { type: Date, default: Date.now }, // server time - authoritative
    clientTimestamp: Date, // informational only
    durationSeconds: { type: Number, default: 0, min: 0, max: 86400 },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
    description: { type: String, maxlength: 300, default: "" },
    countsTowardLimit: { type: Boolean, default: true },
    source: { type: String, enum: ["client", "server"], default: "client" },
  },
  { timestamps: false, toJSON: jsonOpts },
);
securityEventSchema.index({ interviewId: 1, timestamp: 1 });
securityEventSchema.index({ userId: 1 });

const SecurityEvent = mongoose.model("SecurityEvent", securityEventSchema);
SecurityEvent.EVENT_TYPES = EVENT_TYPES;
module.exports = SecurityEvent;
