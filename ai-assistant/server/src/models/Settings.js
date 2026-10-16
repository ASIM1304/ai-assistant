const mongoose = require("mongoose");

/** Singleton document (key = "global") holding admin-configurable settings. */
const settingsSchema = new mongoose.Schema(
  { key: { type: String, default: "global", unique: true }, values: { type: mongoose.Schema.Types.Mixed, default: {} } },
  { timestamps: true, minimize: false },
);

module.exports = mongoose.model("Settings", settingsSchema);
