const express = require("express");
const router = express.Router();

const PRICING = require("../../config/pricing");
const subscriptionService = require("../services/subscriptionService");
const { validateRequired } = require("../utils/validation");
const { sendSuccess, sendError } = require("../utils/response");
const logger = require("../utils/logger");

/**
 * POST /api/subscription/activate
 * Body: { planType: "monthly" | "quarterly" | "halfYearly" | "yearly" }
 */
router.post("/activate", async (req, res) => {
  try {
    const { planType } = req.body || {};
    const validation = validateRequired({ planType }, ["planType"]);
    if (!validation.valid) return sendError(res, validation.errors.join(", "), 400);

    if (!PRICING[planType]) return sendError(res, "Invalid planType", 400);

    if (!req.shopId) return sendError(res, "Shop context missing", 401);

    const result = await subscriptionService.upgradeSubscription(req.shopId, planType);
    if (!result || !result.success) {
      return sendError(res, "Failed to activate subscription", 500);
    }

    logger.info("Subscription activated via API", { shopId: req.shopId.toString(), planType: result.planType });

    return sendSuccess(
      res,
      {
        planType: result.planType,
        price: result.price,
        subscriptionExpiresAt: result.subscriptionExpiresAt,
      },
      "Subscription activated"
    );
  } catch (err) {
    logger.error("Activate subscription error", err);
    return sendError(res, "Failed to activate subscription", 500);
  }
});

/**
 * POST /api/subscription/start-trial
 * Body: { email: string, phone: string }
 * Activates a 30-day free trial for inactive users
 */
router.post("/start-trial", async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    const validation = validateRequired({ email, phone }, ["email", "phone"]);
    if (!validation.valid) return sendError(res, validation.errors.join(", "), 400);

    if (!req.shopId) return sendError(res, "Shop context missing", 401);

    // Fetch the shop to verify current status
    const Shop = require("../models/Shop");
    const shop = await Shop.findById(req.shopId);
    if (!shop) return sendError(res, "Shop not found", 404);

    // Only allow activation if currently inactive
    if (shop.subscriptionStatus !== "inactive") {
      return sendError(res, "Trial can only be activated on inactive accounts", 400);
    }

    // Calculate trial end date (30 days from now)
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Update shop with trial details
    await Shop.findByIdAndUpdate(req.shopId, {
      subscriptionStatus: "trial",
      subscriptionType: "trial",
      trialEndsAt: trialEndsAt,
      subscriptionExpiresAt: null,
      email: email,
      phone: phone,
    });

    logger.info("Trial activated", {
      shopId: req.shopId.toString(),
      email: email,
      phone: phone,
      trialEndsAt: trialEndsAt.toISOString(),
    });

    return sendSuccess(
      res,
      {
        subscriptionStatus: "trial",
        subscriptionType: "trial",
        trialEndsAt: trialEndsAt,
        daysRemaining: 30,
      },
      "30-day free trial activated successfully"
    );
  } catch (err) {
    logger.error("Start trial error", err);
    return sendError(res, "Failed to activate trial", 500);
  }
});

/**
 * GET /api/subscription/status
 */
router.get("/status", async (req, res) => {
  try {
    if (!req.shopId) return sendError(res, "Shop context missing", 401);

    const details = await subscriptionService.getSubscriptionDetails(req.shopId);
    if (!details) return sendError(res, "Subscription details not found", 404);

    return sendSuccess(res, {
      subscriptionStatus: details.subscriptionStatus,
      subscriptionType: details.subscriptionType,
      trialEndsAt: details.trialEndsAt,
      subscriptionExpiresAt: details.subscriptionExpiresAt,
      monthlyPrice: details.monthlyPrice,
    });
  } catch (err) {
    logger.error("Subscription status error", err);
    return sendError(res, "Failed to fetch subscription status", 500);
  }
});

module.exports = router;
