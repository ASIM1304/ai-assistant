const router = require("express").Router();
const c = require("../controllers/profile.controller");
const { protect } = require("../middleware/auth");
const { validate } = require("../utils/validate");
const S = require("./schemas");

router.use(protect);
router.get("/", c.getProfile);
router.put("/", validate({ body: S.profile }), c.updateProfile);
router.get("/export", c.exportData);
router.delete("/", validate({ body: S.deleteAccount }), c.deleteAccount);

module.exports = router;
