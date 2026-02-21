const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const { requireSuperAdmin } = require("../middleware/superAdminCheck");
const Shop = require("../models/Shop");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const activityService = require("../services/activityService");
const { sendSuccess, sendError } = require("../utils/response");

const router = express.Router();

/**
 * GET /api/status/health
 * Public health check (no auth required)
 */
router.get("/health", (_req, res) => {
  const healthcheck = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "unknown",
    mongoConnected: mongoose.connection.readyState === 1,
  };

  if (mongoose.connection.readyState !== 1) {
    healthcheck.status = "DEGRADED";
  }

  const statusCode = healthcheck.status === "UP" ? 200 : 503;
  res.status(statusCode).json({
    success: healthcheck.status === "UP",
    data: healthcheck,
  });
});

/**
 * GET /api/status/ready
 * Kubernetes/orchestrator readiness check
 * Returns 200 only if service is fully ready to serve requests
 */
router.get("/ready", (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Service not ready - database not connected",
    });
  }

  res.json({
    success: true,
    message: "Service ready",
  });
});

/**
 * GET /api/status/live
 * Kubernetes/orchestrator liveness check
 * Returns 200 if process is alive (even if degraded)
 */
router.get("/live", (_req, res) => {
  res.json({
    success: true,
    message: "Service alive",
  });
});

/**
 * GET /api/status/metrics (requires auth)
 * System metrics and stats
 */
router.get("/metrics", authMiddleware, async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
      },
      nodejs: process.version,
      environment: process.env.NODE_ENV,
    };

    return sendSuccess(res, metrics, "Metrics retrieved");
  } catch (error) {
    return sendError(res, "Failed to retrieve metrics", 500);
  }
});

/**
 * GET /api/status/subscription (requires auth)
 * Get current shop subscription status
 */
router.get("/subscription", authMiddleware, async (req, res) => {
  try {
    const shop = await Shop.findById(req.shopId, {
      subscriptionType: 1,
      subscriptionStatus: 1,
      trialEndsAt: 1,
      subscriptionExpiresAt: 1,
      isActive: 1,
    });

    if (!shop) {
      return sendError(res, "Shop not found", 404);
    }

    const now = new Date();
    const daysRemaining =
      shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) > now
        ? Math.ceil((new Date(shop.subscriptionExpiresAt) - now) / (1000 * 60 * 60 * 24))
        : 0;

    return sendSuccess(
      res,
      {
        subscriptionType: shop.subscriptionType,
        subscriptionStatus: shop.subscriptionStatus,
        trialEndsAt: shop.trialEndsAt,
        subscriptionExpiresAt: shop.subscriptionExpiresAt,
        isActive: shop.isActive,
        daysRemaining,
        willExpireSoon: daysRemaining > 0 && daysRemaining <= 7,
      },
      "Subscription status retrieved"
    );
  } catch (error) {
    return sendError(res, "Failed to fetch subscription", 500);
  }
});

/**
 * GET /api/status/activity (requires auth)
 * Get activity logs for the shop
 */
router.get("/activity", authMiddleware, async (req, res) => {
  try {
    const { action, limit = 50, skip = 0 } = req.query;
    const filters = {
      action: action || undefined,
      limit: Math.min(parseInt(limit) || 50, 100), // Max 100
      skip: parseInt(skip) || 0,
    };

    const logs = await activityService.getActivityLogs(req.shopId, filters);
    return sendSuccess(res, logs, "Activity logs retrieved");
  } catch (error) {
    return sendError(res, "Failed to fetch activity logs", 500);
  }
});

/**
 * POST /api/status/export-activity (requires auth)
 * Export activity logs as CSV/JSON
 */
router.post("/export-activity", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, format = "json" } = req.body || {};

    const logs = await activityService.exportActivityLogs(req.shopId, {
      startDate,
      endDate,
    });

    if (format === "csv") {
      // Simple CSV export
      const headers = ["Timestamp", "Action", "User", "Entity Type", "Entity ID", "Description"];
      const rows = logs.map((log) => [
        log.timestamp,
        log.action,
        log.user,
        log.entityType,
        log.entityId,
        log.description,
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell || ""}"`).join(",")).join("\n");

      res.header("Content-Type", "text/csv");
      res.header("Content-Disposition", 'attachment; filename="activity-logs.csv"');
      return res.send(csv);
    }

    return sendSuccess(res, logs, "Activity logs exported");
  } catch (error) {
    return sendError(res, "Failed to export activity logs", 500);
  }
});

module.exports = router;
