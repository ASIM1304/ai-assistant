const express = require("express");
const c = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");
const { validate } = require("../utils/validate");
const S = require("./schemas").auth;

module.exports = (rl) => {
  const router = express.Router();
  router.post("/register", rl.register, validate({ body: S.register }), c.register);
  router.post("/login", rl.login, validate({ body: S.login }), c.login);
  router.post("/logout", protect, c.logout);
  router.get("/me", protect, c.me);
  router.post("/verify-email", rl.passwordFlow, validate({ body: S.token }), c.verifyEmail);
  router.post("/resend-verification", rl.passwordFlow, validate({ body: S.emailOnly }), c.resendVerification);
  router.post("/forgot-password", rl.passwordFlow, validate({ body: S.emailOnly }), c.forgotPassword);
  router.post("/reset-password", rl.passwordFlow, validate({ body: S.reset }), c.resetPassword);
  router.post("/change-password", protect, rl.passwordFlow, validate({ body: S.change }), c.changePassword);
  return router;
};
