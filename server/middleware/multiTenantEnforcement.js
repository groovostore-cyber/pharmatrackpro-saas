/**
 * Multi-tenant enforcement middleware
 * Ensures strict shop scoping in all queries and prevents cross-tenant access
 */

const logger = require("../utils/logger");

/**
 * Enforce shop scoping
 * Verifies that user can only access their own shop's data
 * Use as middleware on routes that have :shopId parameter
 */
function enforceShopAccess(req, res, next) {
  try {
    const requestedShopId = req.params.shopId;

    if (!requestedShopId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required",
      });
    }

    if (!req.shopId) {
      return res.status(401).json({
        success: false,
        message: "User shop ID not found - please login again",
      });
    }

    // Ensure user can only access their own shop
    if (req.shopId.toString() !== requestedShopId.toString()) {
      logger.warn("Unauthorized shop access attempt", {
        userId: req.user?.userId,
        requestedShop: requestedShopId,
        userShop: req.shopId.toString(),
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: You can only access your own shop data",
      });
    }

    next();
  } catch (error) {
    logger.error("Error in enforceShopAccess", error);
    res.status(500).json({
      success: false,
      message: "Error validating access",
    });
  }
}

/**
 * Verify shopId parameter is valid ObjectId
 */
function validateShopIdParam(req, res, next) {
  const shopId = req.params.shopId;

  // Basic ObjectId validation (24 hex characters)
  if (!/^[0-9a-fA-F]{24}$/.test(shopId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid shop ID format",
    });
  }

  next();
}

module.exports = {
  enforceShopAccess,
  validateShopIdParam,
};
