const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, required: true },
    address: { type: String, trim: true, default: "" },
    customerId: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound indexes for multi-tenant data isolation
// Unique per shop (allows same phone/id in different shops)
customerSchema.index({ shop: 1, phone: 1 }, { unique: true });
customerSchema.index({ shop: 1, customerId: 1 }, { unique: true });
customerSchema.index({ shop: 1, name: 1 });

module.exports = mongoose.model("Customer", customerSchema);
