const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const { addIssue } = require("../controller/issue.controller");
const multer = require("multer");
const { issueValidation } = require("../middlewares/validators/issue.validator");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();


// POST /api/issues - Create a new issue
router.post(
  "/",
  createAuthMiddleware(["user"]),
  upload.array("photos", 5), // tests attach using 'photos'
  issueValidation,
  addIssue
);

module.exports = router;
