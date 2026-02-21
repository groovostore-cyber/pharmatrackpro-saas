const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true, trim: true },
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    expiry: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound indexes for multi-tenant queries
medicineSchema.index({ shop: 1, name: 1 });
medicineSchema.index({ shop: 1, stock: 1 });

module.exports = mongoose.model("Medicine", medicineSchema);
