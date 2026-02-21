const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
    store_name: { type: String, default: "PharmaTrackPro Store" },
    owner_name: { type: String, default: "" },
    shop_address: { type: String, default: "" },
    phone_number: { type: String, default: "" },
    whatsapp_number: { type: String, default: "" },
    gst_number: { type: String, default: "" },
    invoice_prefix: { type: String, default: "INV" },
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

// Unique settings document per shop (sparse allows null shop)
settingSchema.index({ shop: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Setting", settingSchema);
