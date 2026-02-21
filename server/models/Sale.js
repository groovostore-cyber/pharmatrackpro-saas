const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    itemDiscount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: { type: [saleItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    gst: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    finalTotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    due: { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound indexes for multi-tenant and efficient queries
saleSchema.index({ shop: 1, createdAt: -1 });
saleSchema.index({ shop: 1, customer: 1 });
saleSchema.index({ shop: 1, due: 1 });

module.exports = mongoose.model("Sale", saleSchema);
