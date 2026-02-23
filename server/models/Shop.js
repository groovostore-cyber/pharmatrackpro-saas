const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true,
    trim: true,
  },
  ownerName: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
  },
  
  // Subscription System (centralized pricing/durations handled elsewhere)
  subscriptionType: {
    type: String,
    enum: ["trial", "monthly", "quarterly", "halfYearly", "yearly"],
    default: "trial",
  },
  subscriptionStatus: {
    type: String,
    enum: ["trial", "active", "expired", "inactive", "suspended"],
    default: "trial",
  },
  trialEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null,
  },
  
  // Shop Status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-update updatedAt on save
shopSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for active shops and subscriptions
shopSchema.index({ isActive: 1 });
shopSchema.index({ subscriptionStatus: 1 });

module.exports = mongoose.model("Shop", shopSchema);
