const express = require("express");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const db = require("../core/database");
const salesService = require("../core/salesService");

const router = express.Router();

// Ensure exports directory exists
function ensureExportDir() {
  const dir = path.join(__dirname, "..", "exports");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// CSV Export - Sales Report
router.get("/sales/csv", (req, res) => {
  try {
    ensureExportDir();
    
    const sales = db.queryAll(`
      SELECT 
        s.id,
        s.customer_id,
        COALESCE(c.name, 'Walk-in Customer') AS customer_name,
        COALESCE(c.phone, 'N/A') AS phone,
        s.subtotal,
        s.overall_discount_percent,
        s.discount_amount,
        s.gst_percent,
        s.gst_amount,
        s.final_total,
        s.paid,
        s.due,
        s.created_at
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
    `);

    if (!sales || sales.length === 0) {
      return res.json({
        success: false,
        message: "No sales data to export",
      });
    }

    // Build CSV headers
    const headers = [
      "Sale ID",
      "Customer Name",
      "Phone",
      "Date",
      "Subtotal",
      "Discount %",
      "Discount Amount",
      "GST %",
      "GST Amount",
      "Final Total",
      "Paid",
      "Due",
    ];

    // Build CSV rows
    const rows = sales.map((s) => [
      s.id,
      `"${String(s.customer_name || "").replace(/"/g, '""')}"`,
      s.phone,
      new Date(s.created_at).toLocaleString("en-IN"),
      s.subtotal.toFixed(2),
      s.overall_discount_percent.toFixed(2),
      s.discount_amount.toFixed(2),
      s.gst_percent.toFixed(2),
      s.gst_amount.toFixed(2),
      s.final_total.toFixed(2),
      s.paid.toFixed(2),
      s.due.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.csv");
    res.send(csvContent);
  } catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate CSV report",
      error: error.message,
    });
  }
});

// XLSX Export - Sales Report
router.get("/sales/xlsx", (req, res) => {
  try {
    const sales = db.queryAll(`
      SELECT 
        s.id,
        s.customer_id,
        COALESCE(c.name, 'Walk-in Customer') AS customer_name,
        COALESCE(c.phone, 'N/A') AS phone,
        s.subtotal,
        s.overall_discount_percent,
        s.discount_amount,
        s.gst_percent,
        s.gst_amount,
        s.final_total,
        s.paid,
        s.due,
        s.created_at
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
    `);

    if (!sales || sales.length === 0) {
      return res.json({
        success: false,
        message: "No sales data to export",
      });
    }

    // Format data for Excel
    const sheetData = sales.map((s) => ({
      "Sale ID": s.id,
      "Customer Name": s.customer_name,
      Phone: s.phone,
      Date: new Date(s.created_at).toLocaleString("en-IN"),
      Subtotal: s.subtotal,
      "Discount %": s.overall_discount_percent,
      "Discount Amount": s.discount_amount,
      "GST %": s.gst_percent,
      "GST Amount": s.gst_amount,
      "Final Total": s.final_total,
      Paid: s.paid,
      Due: s.due,
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

    // Create temporary file and send
    const fileName = `sales-report-${Date.now()}.xlsx`;
    const filePath = path.join(ensureExportDir(), fileName);
    XLSX.writeFile(wb, filePath);

    // Send file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=sales-report.xlsx`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.on("end", () => {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error("XLSX export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate XLSX report",
      error: error.message,
    });
  }
});

// Full Database Backup - JSON
router.get("/full-backup", (req, res) => {
  try {
    const backup = {
      exportDate: new Date().toISOString(),
      customers: db.queryAll("SELECT * FROM customers ORDER BY id ASC"),
      sales: db.queryAll("SELECT * FROM sales ORDER BY id ASC"),
      saleItems: db.queryAll("SELECT * FROM sale_items ORDER BY id ASC"),
      medicines: db.queryAll("SELECT * FROM medicines ORDER BY id ASC"),
      settings: db.queryOne("SELECT * FROM settings WHERE id = 1"),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=pharmatrack-backup-${Date.now()}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error("Full backup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate full backup",
      error: error.message,
    });
  }
});

module.exports = router;
