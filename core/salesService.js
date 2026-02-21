const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const db = require("./database");
const customerService = require("./customerService");

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function createSale(payload = {}) {
  try {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) throw new Error("At least one medicine is required");

    const customerId = payload.customer_id ? Number(payload.customer_id) : null;
    const overallDiscountPercent = Number(payload.overall_discount_percent || 0);
    const gstPercent = Number(payload.gst_percent || 0);
    const paid = Number(payload.paid || 0);
    const saleDate = new Date().toISOString();

    let computedSubtotal = 0;
    const normalizedItems = items.map((item) => {
      const medicineId = Number(item.medicine_id);
      const quantity = Number(item.quantity || 0);
      const discountPercent = Number(item.discount_percent || 0);
      if (!medicineId || quantity <= 0) throw new Error("Invalid item row");

      const medicine = db.queryOne("SELECT * FROM medicines WHERE id = ?", [medicineId]);
      if (!medicine) throw new Error(`Medicine not found for id ${medicineId}`);
      if (Number(medicine.stock_quantity) < quantity) {
        throw new Error(`Insufficient stock for ${medicine.name}`);
      }

      const price = Number(medicine.selling_price || 0);
      const gross = price * quantity;
      const lineDiscount = gross * (discountPercent / 100);
      const lineTotal = round2(gross - lineDiscount);
      computedSubtotal += lineTotal;

      return {
        medicine,
        medicineId,
        quantity,
        discountPercent,
        price,
        lineTotal,
      };
    });

    const subtotal = round2(computedSubtotal);
    const discountAmount = round2(subtotal * (overallDiscountPercent / 100));
    const taxable = round2(subtotal - discountAmount);
    const gstAmount = round2(taxable * (gstPercent / 100));
    const finalTotal = round2(taxable + gstAmount);
    const due = round2(Math.max(finalTotal - paid, 0));

    const result = db.runTransaction(() => {
      const saleResult = db.execute(
        `INSERT INTO sales
         (customer_id, subtotal, overall_discount_percent, discount_amount, gst_percent, gst_amount, final_total, paid, due, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, subtotal, overallDiscountPercent, discountAmount, gstPercent, gstAmount, finalTotal, paid, due, saleDate]
      );

      const saleId = Number(saleResult.lastInsertRowid);
      normalizedItems.forEach((item) => {
        db.execute(
          `INSERT INTO sale_items (sale_id, medicine_id, quantity, price, discount_percent, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.medicineId, item.quantity, item.price, item.discountPercent, item.lineTotal, saleDate]
        );
        db.execute("UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE id = ?", [item.quantity, item.medicineId]);
      });

      if (customerId) {
        customerService.updateCustomerMetrics(customerId, finalTotal, due, saleDate);
      }

      return saleId;
    });

    return getSaleById(result);
  } catch (error) {
    console.error("salesService.createSale error:", error);
    throw error;
  }
}

function getSaleById(saleId) {
  try {
    const sale = db.queryOne(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?`,
      [Number(saleId)]
    );
    if (!sale) return null;

    const items = db.queryAll(
      `SELECT si.*, m.name AS medicine_name
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`,
      [Number(saleId)]
    );

    return { ...sale, items };
  } catch (error) {
    console.error("salesService.getSaleById error:", error);
    throw error;
  }
}

function getAllSales() {
  try {
    return db.queryAll(
      `SELECT s.id, s.created_at, IFNULL(c.name, 'Walk-in Customer') AS customer_name,
              s.subtotal, s.discount_amount, s.gst_amount, s.final_total, s.paid, s.due
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       ORDER BY s.id DESC`
    );
  } catch (error) {
    console.error("salesService.getAllSales error:", error);
    throw error;
  }
}

function ensureExportDir() {
  const dir = path.join(__dirname, "..", "exports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function exportSalesCSV() {
  try {
    const rows = getAllSales();
    const header = "Sale ID,Date,Customer,Subtotal,Discount,GST,Final Total,Paid,Due";
    const lines = rows.map((r) => [
      r.id,
      r.created_at,
      `"${String(r.customer_name || "").replace(/"/g, '""')}"`,
      r.subtotal,
      r.discount_amount,
      r.gst_amount,
      r.final_total,
      r.paid,
      r.due,
    ].join(","));

    const dir = ensureExportDir();
    const fileName = `sales_${Date.now()}.csv`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, [header, ...lines].join("\n"), "utf8");
    return { fileName, url: `/exports/${fileName}` };
  } catch (error) {
    console.error("salesService.exportSalesCSV error:", error);
    throw error;
  }
}

function exportSalesXLSX() {
  try {
    const rows = getAllSales().map((r) => ({
      "Sale ID": r.id,
      Date: r.created_at,
      Customer: r.customer_name,
      Subtotal: r.subtotal,
      Discount: r.discount_amount,
      GST: r.gst_amount,
      "Final Total": r.final_total,
      Paid: r.paid,
      Due: r.due,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: "No sales data" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Sales");

    const dir = ensureExportDir();
    const fileName = `sales_${Date.now()}.xlsx`;
    const filePath = path.join(dir, fileName);
    XLSX.writeFile(wb, filePath);
    return { fileName, url: `/exports/${fileName}` };
  } catch (error) {
    console.error("salesService.exportSalesXLSX error:", error);
    throw error;
  }
}

module.exports = {
  createSale,
  getSaleById,
  getAllSales,
  exportSalesCSV,
  exportSalesXLSX,
};
