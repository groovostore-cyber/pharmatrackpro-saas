/**
 * Request logging middleware
 * Logs incoming requests with method, path, user info
 * Safe: does not log sensitive data
 */

const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override res.send to capture status code
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId || "anonymous",
      shopId: req.shopId || "unknown",
      ip: req.ip || req.connection.remoteAddress,
    };

    // Log based on status code
    if (statusCode >= 500) {
      logger.error(`${req.method} ${req.path} - ${statusCode}`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} - ${statusCode}`, logData);
    } else {
      logger.debug(`${req.method} ${req.path} - ${statusCode}`, logData);
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
}

module.exports = requestLogger;
