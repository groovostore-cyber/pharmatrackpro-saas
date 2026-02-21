const jwt = require("jsonwebtoken");

/**
 * UPDATED for Multi-Tenant: Extracts shopId from JWT payload
 * All protected routes now have req.shopId available for data isolation
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    // support Authorization: Bearer <token> and x-access-token
    let token = null;
    if (typeof authHeader === 'string' && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: token required" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.warn('authMiddleware: token verification failed', err && err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token - please login again' });
    }

    // Attach full payload as req.user for downstream handlers
    req.user = payload || {};

    // Normalize userId, shopId, role
    if (req.user.userId) req.user.userId = String(req.user.userId);

    const rawShopId = req.user.shopId ?? req.user.shop ?? null;
    if (rawShopId) {
      req.user.shopId = String(rawShopId);
      req.shopId = req.user.shopId;
    } else {
      // Allow superadmin tokens without shopId (superadmin bypass)
      if (req.user.role === "superadmin") {
        req.shopId = null;
      } else {
        return res.status(401).json({
          success: false,
          message: 'Shop ID not found in token - please login again',
        });
      }
    }

    if (!req.user.role) req.user.role = 'user';

    return next();
  } catch (error) {
    console.error("authMiddleware error:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

/**
 * Shop access verification - use when route has shopId parameter
 * Ensures user only accesses their own shop: /api/shops/:shopId/...
 */
function verifyShopAccess(req, res, next) {
  const requestedShopId = req.params.shopId;

  if (req.shopId?.toString() !== requestedShopId) {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied: You can only access your own shop data" 
    });
  }

  next();
}

module.exports = authMiddleware;
module.exports.verifyShopAccess = verifyShopAccess;
