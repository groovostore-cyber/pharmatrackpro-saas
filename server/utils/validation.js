/**
 * Input validation and sanitization utilities
 * Prevents NoSQL injection, invalid regex, and invalid data formats
 */

/**
 * Escape special characters in strings for safe regex usage
 * @param {string} str - Input string
 * @returns {string} - Escaped string
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitize user input for search queries
 * Prevents regex injection and returns safe filter object
 * @param {string} query - User search query
 * @returns {{}} - Safe MongoDB filter object
 */
function sanitizeSearchQuery(query, searchFields = ["name", "phone"]) {
  const q = String(query || "").trim();
  
  if (!q || q.length < 1) {
    return {};
  }

  const escapedQuery = escapeRegex(q);
  const conditions = searchFields.map((field) => ({
    [field]: { $regex: escapedQuery, $options: "i" },
  }));

  return conditions.length > 1 ? { $or: conditions } : conditions[0];
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Validate phone number (basic)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
function isValidPhone(phone) {
  const phoneRegex = /^[\d\-\+\(\)\s]+$/;
  return phoneRegex.test(String(phone)) && String(phone).length >= 7;
}

/**
 * Trim and normalize string input
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeString(str) {
  return String(str || "").trim();
}

/**
 * Validate required fields
 * @param {object} data - Data object
 * @param {array} requiredFields - Array of required field names
 * @returns {{valid: boolean, errors: array}} - Validation result
 */
function validateRequired(data, requiredFields = []) {
  const errors = [];

  requiredFields.forEach((field) => {
    const value = data[field];
    if (!value || (typeof value === "string" && !value.trim())) {
      errors.push(`${field} is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prevent NoSQL injection by validating MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || ""));
}

module.exports = {
  escapeRegex,
  sanitizeSearchQuery,
  isValidEmail,
  isValidPhone,
  normalizeString,
  validateRequired,
  isValidObjectId,
};
