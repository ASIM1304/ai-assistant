const router = require("express").Router();
const c = require("../controllers/config.controller");
const { protect } = require("../middleware/auth");

router.get("/privacy", c.privacy); // public: users may read it before signing up
router.get("/roles", protect, c.roles);

module.exports = router;
