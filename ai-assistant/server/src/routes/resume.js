const express = require("express");
const multer = require("multer");
const { config } = require("../config/env");
const { protect } = require("../middleware/auth");
const c = require("../controllers/resume.controller");
const { validate, z } = require("../utils/validate");
const matchBody = z.object({ jobDescription: z.string().trim().min(80).max(6000), aiConsent: z.literal(true) }).strict();

// Memory storage: the file is never written to disk. Type is verified from the
// bytes in the parser, not from the client-declared MIME type.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxResumeBytes, files: 1, fields: 4, parts: 6 } });

module.exports = (rl) => {
  const router = express.Router();
  router.post("/analyze", protect, rl.resume, upload.single("resume"), c.analyze);
  router.post("/match", protect, rl.resume, validate({ body: matchBody }), c.match);
  router.get("/", protect, c.getMine);
  router.delete("/", protect, c.removeMine);
  return router;
};
