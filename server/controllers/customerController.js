const Customer = require("../models/Customer");
const Sale = require("../models/Sale");

exports.getCustomers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    // sanitize query to avoid invalid regex patterns from user input
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const filter = q
      ? {
          $or: [
            { name: { $regex: escapeRegex(q), $options: "i" } },
            { phone: { $regex: escapeRegex(q), $options: "i" } },
          ],
        }
      : {};

    // enforce shop scoping (multi-tenant)
    const shopFilter = { shop: req.shopId };
    const finalFilter = Object.keys(filter).length ? { $and: [shopFilter, filter] } : shopFilter;

    const customers = await Customer.find(finalFilter).sort({ createdAt: -1 });
    const customerIds = customers.map((c) => c._id);
    const sales = await Sale.find({ customer: { $in: customerIds }, shop: req.shopId }).sort({ createdAt: -1 });

    const map = new Map();
    sales.forEach((s) => {
      const key = String(s.customer || "");
      const prev = map.get(key) || {
        totalPurchases: 0,
        totalDue: 0,
        lastPurchaseDate: null,
      };
      prev.totalPurchases += Number(s.finalTotal ?? s.total ?? 0);
      prev.totalDue += Number(s.due || 0);
      if (!prev.lastPurchaseDate || new Date(s.createdAt) > new Date(prev.lastPurchaseDate)) {
        prev.lastPurchaseDate = s.createdAt;
      }
      map.set(key, prev);
    });

    const rows = customers.map((c) => {
      const agg = map.get(String(c._id)) || { totalPurchases: 0, totalDue: 0, lastPurchaseDate: null };
      return {
        ...c.toObject(),
        totalPurchases: agg.totalPurchases,
        totalDue: agg.totalDue,
        lastPurchaseDate: agg.lastPurchaseDate,
      };
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("getCustomers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customers" });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, address } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    if (!phone) return res.status(400).json({ success: false, message: "Phone is required" });

    const normalizedPhone = String(phone).trim();
    const existing = await Customer.findOne({ shop: req.shopId, phone: normalizedPhone });
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const customerId = `CUST-${Date.now()}`;
    const doc = await Customer.create({
      shop: req.shopId,
      name: String(name).trim(),
      phone: normalizedPhone,
      address: String(address || "").trim(),
      customerId,
    });
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("createCustomer error:", error);
    if (error?.code === 11000) {
      const existing = await Customer.findOne({ shop: req.shopId, phone: String(req.body?.phone || "").trim() });
      if (existing) return res.json({ success: true, data: existing });
      return res.status(400).json({ success: false, message: "Phone already exists" });
    }
    return res.status(400).json({ success: false, message: "Failed to save customer" });
  }
};

exports.getCreditCustomers = async (_req, res) => {
  try {
    const sales = await Sale.find({ due: { $gt: 0 }, shop: _req.shopId }).populate("customer").sort({ createdAt: -1 });
    const map = new Map();

    sales.forEach((s) => {
      if (!s.customer) return;
      const id = s.customer._id.toString();
      const prev = map.get(id) || {
        _id: s.customer._id,
        name: s.customer.name,
        phone: s.customer.phone,
        outstanding_credit: 0,
        last_purchase_date: s.createdAt,
      };
      prev.outstanding_credit += Number(s.due || 0);
      if (new Date(s.createdAt) > new Date(prev.last_purchase_date)) prev.last_purchase_date = s.createdAt;
      map.set(id, prev);
    });

    return res.json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    console.error("getCreditCustomers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch credit customers" });
  }
};

exports.getCustomerSales = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || String(customer.shop) !== String(req.shopId))
      return res.status(404).json({ success: false, message: "Customer not found" });

    const sales = await Sale.find({ customer: id, shop: req.shopId })
      .populate("customer")
      .populate("items.medicineId")
      .populate("items.medicine")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: { customer, sales } });
  } catch (error) {
    console.error("getCustomerSales error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer sales" });
  }
};
