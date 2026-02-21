const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },

    // Identify as superadmin
    role: {
      type: String,
      enum: ["superadmin"],
      default: "superadmin",
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Permissions (extensible)
    permissions: {
      type: [String],
      default: ["view_all_shops", "manage_subscriptions", "view_analytics"],
    },

    // Last login tracking
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for superadmin queries
superAdminSchema.index({ isActive: 1 });

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
