/**
 * Subscription management service
 * Handles shop subscription lifecycle and validation
 */

const Shop = require("../models/Shop");
const logger = require("../utils/logger");
const PRICING = require("../../config/pricing");

/**
 * Check if shop subscription is active
 * Returns { isActive: boolean, reason: string }
 */
async function isSubscriptionActive(shopId) {
  try {
    const shop = await Shop.findById(shopId);

    if (!shop) {
      return { isActive: false, reason: "Shop not found" };
    }

    if (!shop.isActive) {
      return { isActive: false, reason: "Shop is deactivated" };
    }

    const now = new Date();

    // Trial handling
    if (shop.subscriptionStatus === "trial") {
      if (shop.trialEndsAt && new Date(shop.trialEndsAt) < now) {
        // Trial expired -> mark expired
        await Shop.updateOne({ _id: shopId }, { subscriptionStatus: "expired" });
        return {
          isActive: false,
          reason: `Free trial expired. Please subscribe for ₹${PRICING.monthly.price}/month to continue.`,
        };
      }
      return { isActive: true, reason: "Trial active" };
    }

    // Suspended accounts
    if (shop.subscriptionStatus === "suspended") {
      return { isActive: false, reason: "Account suspended" };
    }

    // Expired status
    if (shop.subscriptionStatus === "expired") {
      return { isActive: false, reason: "Subscription expired" };
    }

    // Check expiry dates for active subscriptions
    if (shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) < now) {
      await Shop.updateOne({ _id: shopId }, { subscriptionStatus: "expired" });
      return {
        isActive: false,
        reason: `Subscription expired. Please renew for ₹${PRICING.monthly.price}/month.`,
      };
    }

    return { isActive: true, reason: "Subscription active" };
  } catch (err) {
    logger.error("Error checking subscription", err);
    return { isActive: false, reason: "Error checking subscription" };
  }
}

/**
 * Initialize free trial for new shop
 */
async function initializeFreeTrial(shopId) {
  try {
    const trialDays = PRICING.monthly.durationDays || 30;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + Number(trialDays));

    await Shop.updateOne(
      { _id: shopId },
      {
        subscriptionType: "trial",
        subscriptionStatus: "trial",
        trialEndsAt,
        subscriptionExpiresAt: null,
      }
    );

    logger.info("Free trial initialized", { shopId: shopId.toString(), trialDays });
    return true;
  } catch (err) {
    logger.error("Error initializing free trial", err);
    return false;
  }
}

/**
 * Upgrade/activate subscription for shop
 * Returns { success, planType, price, subscriptionExpiresAt }
 */
async function upgradeSubscription(shopId, planType = "monthly") {
  try {
    if (!PRICING[planType]) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    const durationDays = PRICING[planType].durationDays;
    const price = PRICING[planType].price;

    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + Number(durationDays));

    await Shop.updateOne(
      { _id: shopId },
      {
        subscriptionType: planType,
        subscriptionStatus: "active",
        subscriptionExpiresAt,
      }
    );

    logger.info("Subscription activated", { shopId: shopId.toString(), planType, price, durationDays });

    return { success: true, planType, price, subscriptionExpiresAt };
  } catch (err) {
    logger.error("Error upgrading/activating subscription", err);
    return { success: false };
  }
}

/**
 * Suspend subscription
 */
async function suspendSubscription(shopId, reason = "manual") {
  try {
    await Shop.updateOne({ _id: shopId }, { subscriptionStatus: "suspended" });
    logger.warn("Subscription suspended", { shopId: shopId.toString(), reason });
    return true;
  } catch (err) {
    logger.error("Error suspending subscription", err);
    return false;
  }
}

/**
 * Get subscription details
 */
async function getSubscriptionDetails(shopId) {
  try {
    const shop = await Shop.findById(shopId, {
      subscriptionType: 1,
      subscriptionStatus: 1,
      trialEndsAt: 1,
      subscriptionExpiresAt: 1,
      isActive: 1,
    });

    if (!shop) {
      return null;
    }

    const now = new Date();
    const daysRemaining =
      shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) > now
        ? Math.ceil((new Date(shop.subscriptionExpiresAt) - now) / (1000 * 60 * 60 * 24))
        : 0;

    return {
      subscriptionType: shop.subscriptionType,
      subscriptionStatus: shop.subscriptionStatus,
      trialEndsAt: shop.trialEndsAt,
      subscriptionExpiresAt: shop.subscriptionExpiresAt,
      isActive: shop.isActive,
      daysRemaining,
      willExpireSoon: daysRemaining > 0 && daysRemaining <= 7,
      monthlyPrice: PRICING.monthly.price,
    };
  } catch (err) {
    logger.error("Error getting subscription details", err);
    return null;
  }
}

module.exports = {
  isSubscriptionActive,
  initializeFreeTrial,
  upgradeSubscription,
  suspendSubscription,
  getSubscriptionDetails,
};
