/**
 * Structured logging utility
 * Logs messages with timestamps and levels
 * Safe: does NOT log sensitive data like passwords or tokens
 */

const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with timestamp and level
 */
function formatLog(level, message, data = null) {
  const timestamp = getCurrentTimestamp();
  const baseLog = `[${timestamp}] [${level}] ${message}`;

  if (!data) return baseLog;

  // Sanitize data - never log sensitive fields
  const cleanData = sanitizeData(data);
  return `${baseLog} ${JSON.stringify(cleanData)}`;
}

/**
 * Remove sensitive fields from objects before logging
 */
function sanitizeData(data) {
  if (!data || typeof data !== "object") return data;

  const sensitiveFields = ["password", "token", "secret", "apiKey", "JWT_SECRET", "MONGO_URI"];
  const cleaned = JSON.parse(JSON.stringify(data));

  function removeSensitive(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(removeSensitive);
    } else if (typeof obj === "object" && obj !== null) {
      Object.keys(obj).forEach((key) => {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object") {
          removeSensitive(obj[key]);
        }
      });
    }
  }

  removeSensitive(cleaned);
  return cleaned;
}

/**
 * Log debug messages (dev only)
 */
function debug(message, data = null) {
  if (process.env.NODE_ENV === "development") {
    console.log(formatLog(LOG_LEVELS.DEBUG, message, data));
  }
}

/**
 * Log info messages
 */
function info(message, data = null) {
  console.log(formatLog(LOG_LEVELS.INFO, message, data));
}

/**
 * Log warning messages
 */
function warn(message, data = null) {
  console.warn(formatLog(LOG_LEVELS.WARN, message, data));
}

/**
 * Log error messages
 */
function error(message, err = null) {
  if (err instanceof Error) {
    console.error(formatLog(LOG_LEVELS.ERROR, message, { error: err.message, stack: err.stack }));
  } else {
    console.error(formatLog(LOG_LEVELS.ERROR, message, err));
  }
}

module.exports = {
  LOG_LEVELS,
  debug,
  info,
  warn,
  error,
  sanitizeData,
};
