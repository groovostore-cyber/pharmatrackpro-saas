/**
 * Rate limiting middleware
 * Limits requests per IP to prevent abuse
 * 100 requests per 15 minutes per IP
 */

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: "Too many requests, please try again later" },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === "/api/health" || req.path.startsWith("/assets") || req.path.startsWith("/ui");
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit login/signup to 5 attempts per IP per 15 minutes
  message: { success: false, message: "Too many login attempts, please try again later" },
  skipSuccessfulRequests: true, // Don't count successful requests
});

module.exports = {
  limiter,
  authLimiter,
};
