const mongoose = require("mongoose");
const { jsonOpts } = require("./_plugins");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 300 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonOpts },
);

module.exports = mongoose.model("QuestionCategory", categorySchema);
