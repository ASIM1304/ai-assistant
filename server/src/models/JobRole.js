const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const jobRoleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 60 },
    label: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 300 },
    categories: { type: [{ type: String, maxlength: 60 }], default: [] },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: jsonOpts },
);

module.exports = mongoose.model("JobRole", jobRoleSchema);
