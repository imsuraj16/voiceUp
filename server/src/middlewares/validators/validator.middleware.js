const { body, validationResult } = require('express-validator');
const sanitizehtml = require('sanitize-html');

const handleValidation = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({ errors: errors.array() });
	}
	next();
};


const registerUserValidation = [

    body("fullName")
    .exists()
    .withMessage("Full name is required"),

    body("fullName.firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 30 })
    .withMessage("First name must be between 2 and 30 characters")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("fullName.lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 30 })
    .withMessage("Last name must be between 2 and 30 characters")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("password")
    .notEmpty()
    .withMessage("Password is required")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("role")
    .optional()
    .isIn(["user", "moderator", "department", "admin"])
    .withMessage("Invalid role")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("googleId")
    .optional()
    .isString()
    .withMessage("Invalid Google ID"),

    handleValidation,
];

const loginUserValidation = [

    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    body("password")
    .notEmpty()
    .withMessage("Password is required")
    .customSanitizer((value) => sanitizehtml(value, { allowedTags: [], allowedAttributes: {} })),

    handleValidation,
]


module.exports = { registerUserValidation, loginUserValidation };
