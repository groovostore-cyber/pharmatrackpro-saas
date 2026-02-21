const Credit = require("../models/Credit");
const Setting = require("../models/Setting");

async function getStoreName() {
  const setting = await Setting.findOne();
  return setting?.store_name || "PharmaTrackPro Store";
}

exports.getCredits = async (_req, res) => {
  try {
    await Promise.all([
      Credit.updateMany({ shop: _req.shopId, due: { $lte: 0 } }, { $set: { due: 0, status: "paid" } }),
      Credit.updateMany({ shop: _req.shopId, due: { $gt: 0 } }, { $set: { status: "pending" } }),
    ]);

    const rows = await Credit.find({ shop: _req.shopId })
      .populate("customer")
      .populate("sale")
      .sort({ createdAt: -1 });

    const storeName = await getStoreName();
    return res.json({ success: true, data: { storeName, rows } });
  } catch (error) {
    console.error("getCredits error:", error);
    return res.status(500).json({ success: false, message: "Failed to load credits" });
  }
};

exports.updateCreditPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paid = Number(req.body?.paid || 0);
    if (Number.isNaN(paid) || paid < 0) {
      return res.status(400).json({ success: false, message: "Paid amount must be a non-negative number" });
    }

    const credit = await Credit.findOne({ _id: id, shop: req.shopId });
    if (!credit) return res.status(404).json({ success: false, message: "Credit record not found" });

    credit.paid = paid;
    credit.due = Math.max(0, Number(credit.totalAmount || 0) - paid);
    credit.status = credit.due <= 0 ? "paid" : "pending";
    await credit.save();

    const updated = await Credit.findOne({ _id: id, shop: req.shopId }).populate("customer").populate("sale");
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateCreditPayment error:", error);
    return res.status(500).json({ success: false, message: "Failed to update credit payment" });
  }
};
