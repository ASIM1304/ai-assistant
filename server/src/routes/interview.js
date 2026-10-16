const express = require("express");
const c = require("../controllers/interview.controller");
const { protect } = require("../middleware/auth");
const { validate, idParams } = require("../utils/validate");
const S = require("./schemas").interview;

module.exports = (rl) => {
  const router = express.Router();
  router.use(protect); // every interview route requires a session; ownership is checked per interview
  router.get("/", c.list);
  router.get("/active", c.active);
  router.get("/stats/trends", c.trends);
  router.post("/", validate({ body: S.create }), c.create);
  router.get("/:id", validate({ params: idParams }), c.state);
  router.get("/:id/state", validate({ params: idParams }), c.state);
  router.get("/:id/report", validate({ params: idParams }), c.report);
  router.post("/:id/consent", validate({ params: idParams, body: S.consent }), c.consent);
  router.post("/:id/start", validate({ params: idParams, body: S.start }), c.start);
  router.post("/:id/answer", rl.ai, validate({ params: idParams, body: S.answer }), c.answer);
  router.post("/:id/skip", rl.ai, validate({ params: idParams, body: S.skip }), c.skip);
  router.post("/:id/events", validate({ params: idParams, body: S.event }), c.event);
  router.post("/:id/heartbeat", validate({ params: idParams, body: S.empty }), c.heartbeat);
  router.post("/:id/abandon", validate({ params: idParams, body: S.empty }), c.abandon);
  return router;
};
