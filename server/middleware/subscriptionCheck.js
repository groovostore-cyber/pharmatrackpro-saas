/**
 * Subscription enforcement middleware
 * - Superadmin bypasses subscription checks
 * - Blocks inactive accounts (not yet activated)
 * - Enforces trial/active/expired/suspended logic
 * - Auto-transitions trial→expired when trialEndsAt has passed
 */

const subscriptionService = require("../services/subscriptionService");
const logger = require("../utils/logger");
const PRICING = require("../../config/pricing");

async function checkSubscription(req, res, next) {
  try {
    // Superadmin bypass
    if (req.user && req.user.role === "superadmin") {
      return next();
    }

    if (!req.shopId) {
      return res.status(401).json({ success: false, message: "Shop ID not found in request" });
    }

    // Use service to inspect subscription state
    const shop = await subscriptionService.getSubscriptionDetails(req.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const now = new Date();

    // Block inactive accounts
    if (shop.subscriptionStatus === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Trial not activated. Please activate your free 30-day trial to continue.",
      });
    }

    if (shop.subscriptionStatus === "trial") {
      if (shop.trialEndsAt && new Date(shop.trialEndsAt) < now) {
        // Mark expired and block
        await require("../models/Shop").updateOne({ _id: req.shopId }, { subscriptionStatus: "expired" });
        return res.status(403).json({
          success: false,
          message: `Free trial expired. Please subscribe for ₹${PRICING.monthly.price}/month to continue.`,
        });
      }
      // trial active -> allow
      req.subscription = shop;
      return next();
    }

    if (shop.subscriptionStatus === "active") {
      if (shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) < now) {
        // auto-mark expired
        await require("../models/Shop").updateOne({ _id: req.shopId }, { subscriptionStatus: "expired" });
        return res.status(403).json({
          success: false,
          message: `Subscription expired. Please renew for ₹${PRICING.monthly.price}/month.`,
        });
      }
      req.subscription = shop;
      return next();
    }

    if (shop.subscriptionStatus === "suspended") {
      return res.status(403).json({ success: false, message: "Account suspended. Contact support." });
    }

    if (shop.subscriptionStatus === "expired") {
      return res.status(403).json({ success: false, message: `Subscription expired. Please renew for ₹${PRICING.monthly.price}/month.` });
    }

    // Default allow (defensive)
    req.subscription = shop;
    return next();
  } catch (err) {
    logger.error("Error in subscription check middleware", err);
    return res.status(500).json({ success: false, message: "Error checking subscription status" });
  }
}

module.exports = checkSubscription;
