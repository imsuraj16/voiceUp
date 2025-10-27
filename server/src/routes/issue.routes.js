const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const { addIssue, listIssues, updateIssues } = require("../controller/issue.controller");
const multer = require("multer");
const { issueValidation, updateIssueValidation } = require("../middlewares/validators/issue.validator");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();


// GET /api/issues - List issues with filters
router.get("/", listIssues);

// POST /api/issues - Create a new issue
router.post(
  "/",
  createAuthMiddleware(["user"]),
  upload.array("photos", 5), // tests attach using 'photos'
  issueValidation,
  addIssue
);

//PATCH /api/issues/:id - Update an issue
router.patch(
  "/:issueId",
  createAuthMiddleware(["user", "admin", "moderator"]),
  updateIssueValidation,
  updateIssues
);

module.exports = router;
