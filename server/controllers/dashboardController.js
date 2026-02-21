const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");

async function getMonthlyRevenueData(shopId) {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const agg = await Sale.aggregate([
    { $match: { shop: shopId, createdAt: { $gte: lastMonthStart } } },
    {
      $project: {
        monthBucket: {
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
          },
        },
        revenue: { $ifNull: ["$finalTotal", "$total"] },
      },
    },
    {
      $group: {
        _id: "$monthBucket",
        totalRevenue: { $sum: "$revenue" },
      },
    },
  ]);

  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;

  const map = new Map(agg.map((r) => [r._id, Number(r.totalRevenue || 0)]));
  const currentMonthRevenue = map.get(currentKey) || 0;
  const lastMonthRevenue = map.get(lastKey) || 0;
  const growthPercent = lastMonthRevenue === 0
    ? (currentMonthRevenue > 0 ? 100 : 0)
    : ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

  return {
    currentMonthRevenue,
    lastMonthRevenue,
    growthPercent,
    direction: growthPercent >= 0 ? "up" : "down",
  };
}

async function getTopMedicinesData(shopId) {
  return Sale.aggregate([
    { $match: { shop: shopId } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.name",
        totalSold: { $sum: { $ifNull: ["$items.qty", "$items.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        name: "$_id",
        totalSold: 1,
      },
    },
  ]);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

exports.getCards = async (_req, res) => {
  try {
    const today = startOfDay();
    const todaySales = await Sale.find({ shop: _req.shopId, createdAt: { $gte: today } });
    const allSales = await Sale.find({ shop: _req.shopId });
    const medicines = await Medicine.find({ shop: _req.shopId });

    const todayRevenue = todaySales.reduce((a, s) => a + Number(s.total || 0), 0);
    const todayProfit = todaySales.reduce((a, s) => a + Math.max(0, Number(s.total || 0) - Number(s.subtotal || 0) * 0.85), 0);
    const creditOutstanding = allSales.reduce((a, s) => a + Math.max(0, Number(s.due || 0)), 0);
    const lowStockCount = medicines.filter((m) => Number(m.stock || 0) < 10).length;

    return res.json({
      success: true,
      data: { todayRevenue, todayProfit, creditOutstanding, lowStockCount, expiryAlert: 0 },
    });
  } catch (error) {
    console.error("getCards error:", error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard cards" });
  }
};

exports.getMonthlyRevenue = async (_req, res) => {
  try {
    const data = await getMonthlyRevenueData(_req.shopId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getMonthlyRevenue error:", error);
    return res.status(500).json({ success: false, message: "Failed to load monthly revenue" });
  }
};

exports.getTopMedicines = async (_req, res) => {
  try {
    const rows = await getTopMedicinesData(_req.shopId);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("getTopMedicines error:", error);
    return res.status(500).json({ success: false, message: "Failed to load top medicines" });
  }
};

exports.getStats = async (_req, res) => {
  try {
    const [monthly, topMedicines] = await Promise.all([
      getMonthlyRevenueData(_req.shopId),
      getTopMedicinesData(_req.shopId),
    ]);
    return res.json({
      success: true,
      data: {
        currentMonthRevenue: Number(monthly.currentMonthRevenue || 0),
        lastMonthRevenue: Number(monthly.lastMonthRevenue || 0),
        topMedicines,
      },
    });
  } catch (error) {
    console.error("getStats error:", error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard stats" });
  }
};
