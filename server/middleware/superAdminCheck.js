/**
 * SuperAdmin protection middleware
 * Ensures only superadmin users can access superadmin routes
 */

const logger = require("../utils/logger");

/**
 * Check if user is a superadmin
 */
function requireSuperAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user.role !== "superadmin") {
      logger.warn("Unauthorized superadmin access attempt", {
        userId: req.user?.userId,
        role: req.user?.role,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: "Superadmin access required",
      });
    }

    next();
  } catch (error) {
    logger.error("Error in requireSuperAdmin", error);
    res.status(500).json({
      success: false,
      message: "Error checking permissions",
    });
  }
}

/**
 * Check if user has specific permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Superadmin has all permissions
      if (req.user.role === "superadmin") {
        return next();
      }

      // Normal users don't have special permissions for now
      return res.status(403).json({
        success: false,
        message: `Permission required: ${permission}`,
      });
    } catch (error) {
      logger.error("Error checking permission", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
      });
    }
  };
}

module.exports = {
  requireSuperAdmin,
  requirePermission,
};
