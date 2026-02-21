const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Shop = require("../models/Shop");
const subscriptionService = require("../services/subscriptionService");
const { sendSuccess, sendError } = require("../utils/response");
const { validateRequired, normalizeString, isValidEmail } = require("../utils/validation");
const logger = require("../utils/logger");

/**
 * Generate JWT token with user info
 */
function signToken(user) {
  const payload = {
    userId: user._id ? user._id.toString() : String(user.userId || ""),
    shopId: user.shopId ? user.shopId.toString() : (user.shop ? user.shop.toString() : null),
    role: user.role || "staff",
  };

  const expiresIn = process.env.JWT_EXPIRES || "7d";
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

  logger.debug("JWT token generated", {
    userId: payload.userId,
    shopId: payload.shopId,
    role: payload.role,
  });

  return token;
}

/**
 * SIGNUP: Create new shop and user
 */
exports.signup = async (req, res) => {
  try {
    const { username, password, shopName, ownerName, email } = req.body || {};

    // Validate required fields
    const validation = validateRequired({ username, password }, ["username", "password"]);
    if (!validation.valid) {
      return sendError(res, validation.errors.join(", "), 400);
    }

    // Normalize inputs
    const normalizedUsername = normalizeString(username);
    const normalizedPassword = normalizeString(password);

    if (normalizedUsername.length < 3 || normalizedPassword.length < 6) {
      return sendError(res, "Username must be 3+ characters, password must be 6+ characters", 400);
    }

    // Check if user exists
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return sendError(res, "Username already exists", 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    // Create unique email placeholder if not provided
    const placeholderEmail = email && isValidEmail(email) ? email : `${normalizedUsername}.${Date.now()}@local`;

    // Create Shop with inactive subscription (requires explicit activation)
    const shop = await Shop.create({
      shopName: normalizeString(shopName) || `${normalizedUsername}'s Pharmacy`,
      ownerName: normalizeString(ownerName) || "",
      email: placeholderEmail,
      subscriptionStatus: "inactive",
      subscriptionType: null,
      trialEndsAt: null,
      subscriptionExpiresAt: null,
    });

    // Best-effort: run subscription service initializer (should be idempotent)
    try {
      await subscriptionService.initializeFreeTrial(shop._id);
    } catch (e) {
      logger.warn("initializeFreeTrial failed (non-blocking)", { error: e && e.message });
    }

    // Create User with ref to Shop
    const user = await User.create({
      username: normalizedUsername,
      password: hashedPassword,
      shopId: shop._id,
      role: "admin", // First user is admin
    });

    // Generate token
    const token = signToken(user);

    logger.info("New user signup", {
      userId: user._id.toString(),
      shopId: shop._id.toString(),
      username: normalizedUsername,
    });

    return sendSuccess(
      res,
      {
        token,
        user: {
          userId: user._id.toString(),
          username: user.username,
          shopId: shop._id.toString(),
          shopName: shop.shopName,
          role: user.role,
        },
      },
      "Signup successful - Please activate your free 30-day trial",
      201
    );
  } catch (error) {
    logger.error("Signup error", error);

    if (error.code === 11000) {
      return sendError(res, "Email already exists", 400);
    }

    return sendError(res, "Failed to create account", 500);
  }
};

/**
 * LOGIN: Authenticate user and return token
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    // Validate required fields
    const validation = validateRequired({ username, password }, ["username", "password"]);
    if (!validation.valid) {
      return sendError(res, validation.errors.join(", "), 400);
    }

    const normalizedUsername = normalizeString(username);

    // Find user
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      logger.warn("Login failed - user not found", { username: normalizedUsername });
      return sendError(res, "Invalid credentials", 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Login failed - invalid password", { userId: user._id.toString() });
      return sendError(res, "Invalid credentials", 401);
    }

    // If not superadmin, enforce subscription checks at login
    let subDetails = null;
    if (user.role !== "superadmin") {
      // User must have a shop reference
      if (!user.shopId) {
        logger.warn("Login blocked - user has no shop reference", { userId: user._id.toString() });
        return sendError(res, "Invalid account. Please contact support.", 403);
      }

      // Ensure shop exists
      const shop = await Shop.findById(user.shopId).lean();
      if (!shop) {
        logger.warn("Login blocked - shop not found", { userId: user._id.toString(), shopId: user.shopId });
        return sendError(res, "Shop not found.", 403);
      }

      // Ensure subscription fields are configured
      if (!shop.subscriptionStatus) {
        logger.warn("Login blocked - subscription not configured", { shopId: shop._id.toString() });
        return sendError(res, "Subscription not configured.", 403);
      }

      // Use subscription service for derived status when available
      subDetails = await subscriptionService.getSubscriptionDetails(user.shopId);
      // fallback to shop fields if service returns null
      if (!subDetails) {
        subDetails = {
          subscriptionStatus: shop.subscriptionStatus,
          subscriptionType: shop.subscriptionType || null,
          trialEndsAt: shop.trialEndsAt || null,
          subscriptionExpiresAt: shop.subscriptionExpiresAt || null,
        };
      }

      if (subDetails.subscriptionStatus === "expired") {
        return sendError(res, "Subscription expired. Please renew to continue.", 403);
      }

      if (subDetails.subscriptionStatus === "suspended") {
        return sendError(res, "Account suspended.", 403);
      }
    } else {
      // superadmin bypass - attach empty subscription info
      subDetails = {
        subscriptionStatus: "superadmin",
        subscriptionType: null,
        trialEndsAt: null,
        subscriptionExpiresAt: null,
      };
    }

    // Update last login
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    // Generate token
    const token = signToken(user);

    logger.info("User login successful", { userId: user._id.toString(), shopId: user.shopId ? user.shopId.toString() : null });

    // Return subscription-centric payload
    return sendSuccess(
      res,
      {
        token,
        role: user.role,
        shopId: user.shopId ? user.shopId.toString() : null,
        subscriptionStatus: subDetails.subscriptionStatus,
        subscriptionType: subDetails.subscriptionType,
        trialEndsAt: subDetails.trialEndsAt,
        subscriptionExpiresAt: subDetails.subscriptionExpiresAt,
      },
      "Login successful"
    );
  } catch (error) {
    logger.error("Login error", error);
    return sendError(res, "Authentication failed", 500);
  }
};

/**
 * LOGOUT: Client-side logout (just clears token on frontend)
 * Server-side: could implement token blacklist if needed
 */
exports.logout = (_req, res) => {
  return sendSuccess(res, null, "Logout successful");
};
