const express = require("express");
const c = require("../controllers/admin.controller");
const auth = require("../controllers/auth.controller");
const { protectAdmin } = require("../middleware/auth");
const { validate, idParams } = require("../utils/validate");
const S = require("./schemas").admin;
const A = require("./schemas").auth;

module.exports = (rl) => {
const router = express.Router();
router.post("/auth/login", rl.login, validate({ body: A.login }), auth.adminLogin);
router.post("/auth/logout", protectAdmin, auth.adminLogout);
router.get("/auth/me", protectAdmin, auth.adminMe);
router.use(protectAdmin); // everything below needs an ADMIN session (a candidate cookie is useless here)
router.get("/stats", c.stats);
router.get("/candidates", validate({ query: S.listQuery }), c.listCandidates);
router.patch("/candidates/:id", validate({ params: idParams, body: S.active }), c.setCandidateActive);
router.delete("/candidates/:id", validate({ params: idParams }), c.deleteCandidate);
router.get("/interviews", validate({ query: S.listQuery }), c.listInterviews);
router.post("/interviews/schedule", validate({ body: S.schedule }), c.scheduleInterview);
router.get("/interviews/:id", validate({ params: idParams }), c.interviewDetail);
router.post("/interviews/:id/review", validate({ params: idParams, body: S.review }), c.reviewInterview);
router.get("/job-roles", c.listRoles);
router.post("/job-roles", validate({ body: S.role }), c.createRole);
router.patch("/job-roles/:id", validate({ params: idParams, body: S.role.partial().strict() }), c.updateRole);
router.delete("/job-roles/:id", validate({ params: idParams }), c.deleteRole);
router.get("/categories", c.listCategories);
router.post("/categories", validate({ body: S.category }), c.createCategory);
router.patch("/categories/:id", validate({ params: idParams, body: S.category.partial().strict() }), c.updateCategory);
router.get("/settings", c.getSettings);
router.put("/settings", validate({ body: S.settings }), c.putSettings);
router.get("/activity", c.activity);

return router;
};
