const db = require("./database");

function getBusinessSnapshot() {
  try {
    const todayRevenue = db.queryOne(
      `SELECT IFNULL(SUM(final_total),0) AS value
       FROM sales
       WHERE date(created_at) = date('now','localtime')`
    )?.value || 0;

    const todayProfit = db.queryOne(
      `SELECT IFNULL(SUM(si.line_total - (m.mrp * si.quantity)),0) AS value
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN medicines m ON m.id = si.medicine_id
       WHERE date(s.created_at) = date('now','localtime')`
    )?.value || 0;

    const creditOutstanding = db.queryOne("SELECT IFNULL(SUM(due),0) AS value FROM sales")?.value || 0;
    const lowStockCount = db.queryOne("SELECT COUNT(*) AS value FROM medicines WHERE stock_quantity < 10")?.value || 0;
    const expiryAlert = db.queryOne(
      `SELECT COUNT(*) AS value
       FROM medicines
       WHERE expiry_date IS NOT NULL
         AND expiry_date != ''
         AND date(expiry_date) <= date('now','+30 day')`
    )?.value || 0;

    return {
      todayRevenue: Number(todayRevenue.toFixed(2)),
      todayProfit: Number(todayProfit.toFixed(2)),
      creditOutstanding: Number(creditOutstanding.toFixed(2)),
      lowStockCount,
      expiryAlert,
    };
  } catch (error) {
    console.error("analyticsService.getBusinessSnapshot error:", error);
    throw error;
  }
}

function getMonthlyRevenueComparison() {
  try {
    const currentMonth = db.queryOne(
      `SELECT IFNULL(SUM(final_total),0) AS value
       FROM sales
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')`
    )?.value || 0;

    const lastMonth = db.queryOne(
      `SELECT IFNULL(SUM(final_total),0) AS value
       FROM sales
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', date('now', '-1 month', 'localtime'))`
    )?.value || 0;

    let growthPercent = 0;
    if (Number(lastMonth) === 0) {
      growthPercent = Number(currentMonth) > 0 ? 100 : 0;
    } else {
      growthPercent = ((Number(currentMonth) - Number(lastMonth)) / Number(lastMonth)) * 100;
    }

    return {
      currentMonth: Number(Number(currentMonth).toFixed(2)),
      lastMonth: Number(Number(lastMonth).toFixed(2)),
      growthPercent: Number(growthPercent.toFixed(2)),
      direction: growthPercent >= 0 ? "up" : "down",
    };
  } catch (error) {
    console.error("analyticsService.getMonthlyRevenueComparison error:", error);
    throw error;
  }
}

function getTopSellingMedicines() {
  try {
    return db.queryAll(
      `SELECT m.name, IFNULL(SUM(si.quantity),0) AS total_quantity
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       GROUP BY si.medicine_id, m.name
       ORDER BY total_quantity DESC
       LIMIT 5`
    );
  } catch (error) {
    console.error("analyticsService.getTopSellingMedicines error:", error);
    throw error;
  }
}

module.exports = {
  getBusinessSnapshot,
  getMonthlyRevenueComparison,
  getTopSellingMedicines,
};
