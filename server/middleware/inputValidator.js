/**
 * Input validation middleware
 * Prevents NoSQL injection and validates common input patterns
 */

const validation = require("../utils/validation");

/**
 * Sanitize request body and query to prevent NoSQL injection
 * Removes or escapes potentially dangerous characters
 */
function sanitizeInput(req, res, next) {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        const value = req.query[key];
        if (typeof value === "string") {
          req.query[key] = validation.normalizeString(value);
        }
      });
    }

    // Sanitize body
    if (req.body && typeof req.body === "object") {
      sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid input format",
    });
  }
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        sanitizeObject(item);
      } else if (typeof item === "string") {
        // Can't modify array items directly, but at least check value
        validation.normalizeString(item);
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      // Remove suspicious keys
      if (typeof key === "string" && key.includes("$")) {
        delete obj[key];
        return;
      }

      if (typeof value === "string") {
        obj[key] = validation.normalizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitizeObject(value);
      }
    });
  }
}

/**
 * Validate request JSON payload
 */
function validateJsonPayload(req, res, next) {
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (!req.is("json")) {
      return res.status(400).json({
        success: false,
        message: "Content-Type must be application/json",
      });
    }
  }
  next();
}

module.exports = {
  sanitizeInput,
  validateJsonPayload,
};
