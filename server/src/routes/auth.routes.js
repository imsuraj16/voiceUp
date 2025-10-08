const express = require("express");
const passport = require("passport");
const { registerUser, googleAuthCallback, loginUser, refreshToken } = require("../controller/auth.controller");
const { registerUserValidation, loginUserValidation } = require("../middlewares/validators/validator.middleware");

// Create a router
const router = express.Router();

// Google OAuth start
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleAuthCallback
);

// Register user
router.post("/register", registerUserValidation, registerUser);

//login user
router.post('/login',loginUserValidation,loginUser);

//refresh token
router.post('/refresh-token', refreshToken)


module.exports = router;
