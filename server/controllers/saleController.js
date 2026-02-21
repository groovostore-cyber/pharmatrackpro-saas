const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const Credit = require("../models/Credit");

exports.createSale = async (req, res) => {
  try {
    const { customer, items = [], subtotal = 0, gst = 0, discount = 0, finalTotal, total = 0, paid = 0, due = 0 } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: "At least one sale item is required" });
    }

    const normalizedItems = [];
    for (const item of items) {
      const medicine = await Medicine.findById(item.medicine);
      if (!medicine || String(medicine.shop) !== String(req.shopId))
        return res.status(400).json({ success: false, message: "Invalid medicine selected" });

      const qty = Number(item.quantity || 0);
      if (qty < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
      if (medicine.stock < qty) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${medicine.name}` });
      }

      const price = Number(item.price ?? medicine.sellingPrice ?? 0);
      const itemDiscount = Number(item.itemDiscount || 0);
      const lineTotal = Number(item.lineTotal || (price * qty) - ((price * qty) * (itemDiscount / 100)));

      normalizedItems.push({
        medicineId: medicine._id,
        medicine: medicine._id,
        name: medicine.name,
        qty,
        quantity: qty,
        price,
        itemDiscount,
        total: lineTotal,
        lineTotal,
      });
    }

    for (const item of normalizedItems) {
      await Medicine.findOneAndUpdate({ _id: item.medicineId, shop: req.shopId }, { $inc: { stock: -item.quantity } });
    }

    const sale = await Sale.create({
      shop: req.shopId,
      customer: customer || null,
      items: normalizedItems,
      subtotal: Number(subtotal || 0),
      gst: Number(gst || 0),
      discount: Number(discount || 0),
      finalTotal: Number(finalTotal ?? total ?? 0),
      total: Number(total || 0),
      paid: Number(paid || 0),
      due: Number(due || 0),
    });

    const numericDue = Number(due || 0);
    if (numericDue > 0) {
      if (!customer) {
        return res.status(400).json({ success: false, message: "Customer is required for due/credit sales" });
      }

      await Credit.findOneAndUpdate(
        { sale: sale._id, shop: req.shopId },
        {
          customer,
          phone: String(req.body?.customerPhone || "").trim(),
          sale: sale._id,
          medicines: normalizedItems.map((i) => i.name),
          totalAmount: Number(finalTotal ?? total ?? 0),
          paid: Number(paid || 0),
          due: numericDue,
          status: numericDue <= 0 ? "paid" : "pending",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    const populated = await Sale.findOne({ _id: sale._id, shop: req.shopId }).populate("customer").populate("items.medicineId").populate("items.medicine");
    return res.json({ success: true, data: populated });
  } catch (error) {
    console.error("createSale error:", error);
    return res.status(500).json({ success: false, message: "Failed to create sale" });
  }
};

exports.getSales = async (req, res) => {
  try {
    const rows = await Sale.find({ shop: req.shopId }).populate("customer").populate("items.medicineId").populate("items.medicine").sort({ createdAt: -1 });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("getSales error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch sales" });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, shop: req.shopId }).populate("customer").populate("items.medicineId").populate("items.medicine");
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    return res.json({ success: true, data: sale });
  } catch (error) {
    console.error("getSaleById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch sale" });
  }
};
