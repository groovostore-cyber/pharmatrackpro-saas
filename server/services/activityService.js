/**
 * Activity logging service
 * Records all significant actions in the system for audit trails
 */

const ActivityLog = require("../models/ActivityLog");
const logger = require("../utils/logger");

/**
 * Log an activity
 * @param {string} shopId - Shop ID
 * @param {string} userId - User ID (optional)
 * @param {string} action - Action type
 * @param {string} entityType - Entity type (Customer, Medicine, Sale, etc.)
 * @param {string} entityId - Entity ID
 * @param {string} description - Description of the action
 * @param {object} metadata - Additional metadata (ipAddress, userAgent, etc.)
 */
async function logActivity(
  shopId,
  userId,
  action,
  entityType = null,
  entityId = null,
  description = "",
  metadata = {}
) {
  try {
    const log = new ActivityLog({
      shop: shopId,
      user: userId || null,
      action,
      entityType,
      entityId,
      description,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
    });

    await log.save();
    logger.debug("Activity logged", { action, entityType, shopId: shopId.toString() });
  } catch (err) {
    logger.error("Error logging activity", err);
    // Don't throw - activity logging should not break the main request
  }
}

/**
 * Get activity logs for a shop
 * @param {string} shopId - Shop ID
 * @param {object} filters - Filter options (action, user, entityType, limit, skip)
 */
async function getActivityLogs(shopId, filters = {}) {
  try {
    const { action, user, entityType, limit = 50, skip = 0 } = filters;

    const query = { shop: shopId };

    if (action) query.action = action;
    if (user) query.user = user;
    if (entityType) query.entityType = entityType;

    const logs = await ActivityLog.find(query)
      .populate("user", "username") // Only get username
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await ActivityLog.countDocuments(query);

    return {
      data: logs,
      total,
      limit,
      skip,
    };
  } catch (err) {
    logger.error("Error fetching activity logs", err);
    return {
      data: [],
      total: 0,
      error: err.message,
    };
  }
}

/**
 * Bulk log activities (for operations with multiple changes)
 */
async function bulkLogActivity(shopId, userId, activities = []) {
  try {
    const logs = activities.map((activity) => ({
      shop: shopId,
      user: userId || null,
      action: activity.action,
      entityType: activity.entityType || null,
      entityId: activity.entityId || null,
      description: activity.description || "",
      ipAddress: activity.ipAddress || null,
      userAgent: activity.userAgent || null,
    }));

    await ActivityLog.insertMany(logs);
    logger.debug("Bulk activities logged", { count: logs.length, shopId: shopId.toString() });
  } catch (err) {
    logger.error("Error bulk logging activities", err);
  }
}

/**
 * Export activity logs (for audit purposes)
 */
async function exportActivityLogs(shopId, filters = {}) {
  try {
    const { action, user, entityType, startDate, endDate } = filters;

    const query = { shop: shopId };

    if (action) query.action = action;
    if (user) query.user = user;
    if (entityType) query.entityType = entityType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Include full day
        query.createdAt.$lt = end;
      }
    }

    const logs = await ActivityLog.find(query)
      .populate("user", "username")
      .sort({ createdAt: -1 });

    return logs.map((log) => ({
      timestamp: log.createdAt,
      action: log.action,
      user: log.user?.username || "System",
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      ipAddress: log.ipAddress,
    }));
  } catch (err) {
    logger.error("Error exporting activity logs", err);
    return [];
  }
}

module.exports = {
  logActivity,
  getActivityLogs,
  bulkLogActivity,
  exportActivityLogs,
};
