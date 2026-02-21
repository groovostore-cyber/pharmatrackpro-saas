const Medicine = require("../models/Medicine");

exports.getMedicines = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const filter = q ? { name: { $regex: escapeRegex(q), $options: "i" } } : {};
    const finalFilter = Object.keys(filter).length ? { $and: [{ shop: req.shopId }, filter] } : { shop: req.shopId };
    const rows = await Medicine.find(finalFilter).sort({ createdAt: -1 });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("getMedicines error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch medicines" });
  }
};

exports.createMedicine = async (req, res) => {
  try {
    const { name, mrp, sellingPrice, selling_price, stock, stock_quantity, expiry, expiry_date } = req.body || {};
    const doc = await Medicine.create({
      shop: req.shopId,
      name: String(name || "").trim(),
      mrp: Number(mrp || 0),
      sellingPrice: Number(sellingPrice ?? selling_price ?? 0),
      stock: Number(stock ?? stock_quantity ?? 0),
      expiry: String(expiry ?? expiry_date ?? ""),
    });
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("createMedicine error:", error);
    return res.status(400).json({ success: false, message: "Failed to save medicine" });
  }
};

exports.updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const update = {};
    const body = req.body || {};

    if (typeof body.name !== "undefined") update.name = String(body.name).trim();
    if (typeof body.mrp !== "undefined") update.mrp = Number(body.mrp || 0);
    if (typeof body.sellingPrice !== "undefined" || typeof body.selling_price !== "undefined") {
      update.sellingPrice = Number(body.sellingPrice ?? body.selling_price ?? 0);
    }
    if (typeof body.stock !== "undefined" || typeof body.stock_quantity !== "undefined") {
      update.stock = Number(body.stock ?? body.stock_quantity ?? 0);
    }
    if (typeof body.expiry !== "undefined" || typeof body.expiry_date !== "undefined") {
      update.expiry = String(body.expiry ?? body.expiry_date ?? "");
    }

    const existing = await Medicine.findById(id);
    if (!existing || String(existing.shop) !== String(req.shopId)) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    const doc = await Medicine.findOneAndUpdate({ _id: id, shop: req.shopId }, update, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Medicine not found" });
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("updateMedicine error:", error);
    return res.status(400).json({ success: false, message: "Failed to update medicine" });
  }
};

exports.updateStockByIncrement = async (req, res) => {
  try {
    const { id } = req.params;
    const addStock = Number(req.body?.addStock ?? 0);
    const expiry = req.body?.expiry;

    if (Number.isNaN(addStock) || addStock < 0) {
      return res.status(400).json({ success: false, message: "Add stock must be a non-negative number" });
    }

    const existing = await Medicine.findById(id);
    if (!existing || String(existing.shop) !== String(req.shopId)) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    const update = { $inc: { stock: addStock } };
    if (expiry) {
      update.$set = { expiry: String(expiry) };
    }

    const updated = await Medicine.findOneAndUpdate({ _id: id, shop: req.shopId }, update, { new: true });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateStockByIncrement error:", error);
    return res.status(500).json({ success: false, message: "Failed to update stock" });
  }
};
