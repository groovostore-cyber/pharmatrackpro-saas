const Setting = require("../models/Setting");

async function getOrCreate(shopId) {
  let s = null;
  if (shopId) s = await Setting.findOne({ shop: shopId });
  if (!s) s = await Setting.create({ shop: shopId || null, store_name: "PharmaTrackPro Store" });
  return s;
}

exports.getSettings = async (req, res) => {
  try {
    const shopId = req.shopId;
    if (!shopId) return res.status(400).json({ success: false, message: "Missing shop context" });
    const s = await getOrCreate(shopId);
    return res.json({ success: true, data: s });
  } catch (error) {
    console.error("getSettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to load settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const shopId = req.shopId;
    if (!shopId) return res.status(400).json({ success: false, message: "Missing shop context" });

    const s = await getOrCreate(shopId);

    // Update all fields from request
    s.store_name = String(req.body?.store_name || "PharmaTrackPro Store").trim() || "PharmaTrackPro Store";
    s.owner_name = String(req.body?.owner_name || "").trim();
    s.shop_address = String(req.body?.shop_address || "").trim();
    s.phone_number = String(req.body?.phone_number || "").trim();
    s.whatsapp_number = String(req.body?.whatsapp_number || "").trim();
    s.gst_number = String(req.body?.gst_number || "").trim();
    s.invoice_prefix = String(req.body?.invoice_prefix || "INV").trim();
    s.currency = String(req.body?.currency || "INR").trim();

    await s.save();
    return res.json({ success: true, data: s });
  } catch (error) {
    console.error("updateSettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to update settings" });
  }
};
