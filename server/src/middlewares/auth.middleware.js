const config = require("../config/config");
const userModel = require("../models/user/user.model");
const jwt = require("jsonwebtoken");

function createAuthMiddleware(roles = ["user"]) {
  return async function authMiddleware(req, res, next) {
    const { accessToken } = req.cookies;

    if (!accessToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const decoded = jwt.verify(accessToken, config.JWT_ACCESS_SECRET);

      const user = await userModel.findById(decoded.id);
      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  };
}

module.exports = createAuthMiddleware;
