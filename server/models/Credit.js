const mongoose = require("mongoose");

const creditSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    phone: { type: String, trim: true, default: "" },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, unique: true },
    medicines: { type: [String], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0, default: 0 },
    due: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
  },
  { timestamps: true }
);

// Compound indexes for efficient multi-tenant queries
creditSchema.index({ shop: 1, customer: 1 });
creditSchema.index({ shop: 1, status: 1 });

creditSchema.pre("save", function setStatus(next) {
  this.status = Number(this.due || 0) <= 0 ? "paid" : "pending";
  next();
});

module.exports = mongoose.model("Credit", creditSchema);
