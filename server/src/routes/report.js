const express = require("express");
const { protect } = require("../middleware/auth");
const { getReport } = require("../controllers/reportcontroller");

const router = express.Router();

router.get("/:sessionId", protect, getReport);

module.exports = router;