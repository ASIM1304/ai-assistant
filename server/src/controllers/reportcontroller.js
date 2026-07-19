const InterviewReport = require("../models/InterviewReport");

const getReport = async (req, res) => {
  try {
    const report = await InterviewReport.findOne({
      interview: req.params.sessionId,
      user: req.userId,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Interview report not found.",
      });
    }

    return res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getReport,
};