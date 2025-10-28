const { body, validationResult, param } = require("express-validator");
const sanitizehtml = require("sanitize-html");

// Middleware to coerce lat/lng into location object for validation
function coerceLocation(req, _res, next) {
  if (
    // !req.body.location &&
    req.body.lng !== undefined &&
    req.body.lat !== undefined
  ) {
    const lng = Number(req.body.lng);
    const lat = Number(req.body.lat);
    if (!isNaN(lng) && !isNaN(lat)) {
      req.body.location = { type: "Point", coordinates: [lng, lat] };
    }
  }
  next();
}

const validateIssue = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorList = errors.array();

    // Check agar koi "is required" type error hai
    const hasMissingField = errorList.some(
      (err) =>
        err.msg.toLowerCase().includes("required") ||
        err.msg.toLowerCase().includes("invalid category") ||
        err.msg.toLowerCase().includes("invalid issue id")
    );

    // Agar required field missing hai -> 400
    if (hasMissingField) {
      return res.status(400).json({ errors: errorList });
    }

    // Warna invalid data (enum, location shape, etc.) -> 422
    return res.status(422).json({ errors: errorList });
  }

  next();
};

const issueValidation = [
  coerceLocation,
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters")
    .customSanitizer((value) =>
      sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })
    ),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters")
    .customSanitizer((value) =>
      sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })
    ),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["road", "lighting", "waste", "safety", "water", "other"])
    .withMessage("Invalid category")
    .customSanitizer((value) =>
      sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })
    ),
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters")
    .customSanitizer((value) =>
      sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })
    ),

  body("location")
    .customSanitizer((v) => {
      // Allow JSON string form
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch {
          // leave as is; validator will throw structured error later
          return v;
        }
      }
      // Coerce coordinate strings to numbers if possible
      if (v && typeof v === "object" && Array.isArray(v.coordinates)) {
        v.coordinates = v.coordinates.map((c) => {
          if (typeof c === "string" && c.trim() !== "") {
            const num = Number(c);
            return isNaN(num) ? c : num;
          }
          return c;
        });
      }
      return v;
    })
    .custom((value, { req }) => {
      // Agar body mein nahi hai lekin lat/lng diye the to coerceLocation ne bana dena chahiye
      if (!value) {
        throw new Error("Location is required");
      }
      if (
        typeof value !== "object" ||
        value.type !== "Point" ||
        !Array.isArray(value.coordinates) ||
        value.coordinates.length !== 2
      ) {
        throw new Error(
          "Location must be a GeoJSON Point with coordinates [lng, lat]"
        );
      }
      const [lng, lat] = value.coordinates;
      if (
        typeof lng !== "number" ||
        typeof lat !== "number" ||
        Number.isNaN(lng) ||
        Number.isNaN(lat) ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        throw new Error("Invalid coordinates");
      }
      return true;
    }),
  validateIssue,
];

const updateIssueValidation = [
  coerceLocation,
  body("title")
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters")
    .customSanitizer((v) =>
      sanitizehtml(v, { allowedTags: [], allowedAttributes: {} })
    ),
  body("description")
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters")
    .customSanitizer((v) =>
      sanitizehtml(v, { allowedTags: [], allowedAttributes: {} })
    ),
  body("category")
    .optional()
    .isIn(["road", "lighting", "waste", "safety", "water", "other"])
    .withMessage("Invalid category")
    .customSanitizer((v) =>
      sanitizehtml(v, { allowedTags: [], allowedAttributes: {} })
    ),
  body("address")
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters")
    .customSanitizer((v) =>
      sanitizehtml(v, { allowedTags: [], allowedAttributes: {} })
    ),
  body("status")
    .optional()
    .isIn(["reported", "in_progress", "resolved"])
    .withMessage("Invalid status"),
  body("location")
    .optional()
    .customSanitizer((v) => {
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch {
          return v;
        }
      }
      if (v && typeof v === "object" && Array.isArray(v.coordinates)) {
        v.coordinates = v.coordinates.map((c) => {
          if (typeof c === "string" && c.trim() !== "") {
            const num = Number(c);
            return Number.isNaN(num) ? c : num;
          }
          return c;
        });
      }
      return v;
    })
    .custom((value) => {
      if (value === undefined) return true; // optional
      if (
        typeof value !== "object" ||
        value.type !== "Point" ||
        !Array.isArray(value.coordinates) ||
        value.coordinates.length !== 2
      ) {
        throw new Error(
          "Location must be a GeoJSON Point with coordinates [lng, lat]"
        );
      }
      const [lng, lat] = value.coordinates;
      if (
        typeof lng !== "number" ||
        typeof lat !== "number" ||
        Number.isNaN(lng) ||
        Number.isNaN(lat) ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        throw new Error("Invalid coordinates");
      }
      return true;
    }),

  param("issueId").isMongoId().withMessage("Invalid issue ID format"),
  validateIssue,
];

module.exports = { issueValidation, updateIssueValidation };
