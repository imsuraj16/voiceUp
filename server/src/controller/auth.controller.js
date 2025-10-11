const userModel = require("../models/user/user.model");
const bcrypt = require("bcryptjs");
const authHelper = require("../helper/auth.helper");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// Register a new user
const registerUser = async (req, res) => {
  try {
    const {
      fullName: { firstName, lastName },
      email,
      password,
      role,
    } = req.body;

    const existinguser = await userModel.findOne({ email });

    if (existinguser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = await userModel.create({
      fullName: { firstName, lastName },
      email,
      password: await bcrypt.hash(password, 10),
      role,
    });

    const { accessToken, refreshToken } = authHelper(newUser);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    newUser.refreshToken = hashedRefreshToken;
    await newUser.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Google OAuth callback handler
const googleAuthCallback = async (req, res) => {
  try {
    const {
      id,
      emails: [email],
      name: { givenName: firstName, familyName: lastName },
    } = req.user;
    const allowedRoles = ["admin", "moderator", "department"];

    const assignedRole = {
      "admin@example.com": "admin",
      "mod@example.com": "moderator",
      "dept@example.com": "department",
    };

    const role = assignedRole[email.value] || "user";

    const userExists = await userModel.findOne({
      $or: [{ googleId: id }, { email: email.value }],
    });

    if (userExists) {
      if (!allowedRoles.includes(userExists.role)) {
        userExists.role = role;
        await userExists.save();
      }

      const { accessToken, refreshToken } = authHelper(userExists);
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

      userExists.refreshToken = hashedRefreshToken;
      await userExists.save();

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
      });

      return res.status(200).json({
        message: "User logged in successfully",
        user: {
          id: userExists._id,
          fullName: userExists.fullName,
          email: userExists.email,
          role: userExists.role,
        },
      });
    }
    const newUser = await userModel.create({
      fullName: { firstName, lastName },
      email: email.value,
      googleId: id,
      role: role,
    });

    const { accessToken, refreshToken } = authHelper(newUser);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    newUser.refreshToken = hashedRefreshToken;
    await newUser.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

//login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = authHelper(user);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    return res.status(200).json({
      message: "User logged in successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Refresh token handler
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);

      const user = await userModel.findById(decoded.id);

      if (!user) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      const isRefreshTokenMatch = await bcrypt.compare(
        refreshToken,
        user.refreshToken || ""
      );

      if (!isRefreshTokenMatch) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      const { accessToken, refreshToken: newRefreshToken } = authHelper(user);
      const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

      user.refreshToken = hashedRefreshToken;
      await user.save();

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
      });

      return res.status(200).json({
        message: "Token refreshed successfully",
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { registerUser, googleAuthCallback, loginUser, refreshToken };
