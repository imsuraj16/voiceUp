const jwt = require("jsonwebtoken");
const config = require('../config/config')

const authHelper = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    config.JWT_ACCESS_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    config.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

module.exports = authHelper;
