const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Which shop this activity belongs to
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // Who performed the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Action type
    action: {
      type: String,
      enum: [
        "create_customer",
        "update_customer",
        "delete_customer",
        "create_medicine",
        "update_medicine",
        "delete_medicine",
        "create_sale",
        "update_sale",
        "refund_sale",
        "update_credit",
        "update_settings",
        "user_login",
        "user_logout",
        "export_data",
        "import_data",
      ],
      required: true,
    },

    // Entity type (Customer, Sale, Medicine, etc.)
    entityType: {
      type: String,
      enum: ["Customer", "Medicine", "Sale", "Credit", "Setting", "User"],
      default: null,
    },

    // Entity ID (ID of customer, sale, etc.)
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Change description
    description: {
      type: String,
      default: "",
    },

    // IP address or user agent for security tracking
    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
activityLogSchema.index({ shop: 1, createdAt: -1 });
activityLogSchema.index({ shop: 1, user: 1 });
activityLogSchema.index({ shop: 1, action: 1 });
activityLogSchema.index({ shop: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
