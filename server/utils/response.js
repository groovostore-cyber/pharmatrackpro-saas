/**
 * Standardized API response wrapper
 * Ensures all API responses follow the same format:
 * { success: true/false, message: "", data: {} }
 */

function success(data = null, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

function error(message = "An error occurred", statusCode = 400, details = null) {
  const response = {
    success: false,
    message,
  };

  if (details && process.env.NODE_ENV === "development") {
    response.details = details;
  }

  return { response, statusCode };
}

/**
 * Send standardized success response
 */
function sendSuccess(res, data = null, message = "Success", statusCode = 200) {
  res.status(statusCode).json(success(data, message));
}

/**
 * Send standardized error response
 */
function sendError(res, message = "An error occurred", statusCode = 400, details = null) {
  const { response, statusCode: status } = error(message, statusCode, details);
  res.status(status).json(response);
}

module.exports = {
  success,
  error,
  sendSuccess,
  sendError,
};
