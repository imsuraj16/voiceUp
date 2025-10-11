const { body, validationResult } = require("express-validator");
const sanitizehtml = require("sanitize-html");

// Middleware to coerce lat/lng into location object for validation
function coerceLocation(req, _res, next) {
  if (!req.body.location && req.body.lng !== undefined && req.body.lat !== undefined) {
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
    return res.status(400).json({ errors: errors.array() });
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
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["road", "lighting", "waste", "safety", "water", "other"])
    .withMessage("Invalid category")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

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
        v.coordinates = v.coordinates.map(c => {
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
        throw new Error("Location must be a GeoJSON Point with coordinates [lng, lat]");
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

module.exports = { issueValidation };
