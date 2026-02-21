const express = require("express");
const XLSX = require("xlsx");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const Medicine = require("../models/Medicine");
const Setting = require("../models/Setting");

const router = express.Router();

/**
 * CSV Export - Sales Report
 * GET /api/export/sales/csv
 */
router.get("/sales/csv", async (req, res) => {
  try {
    const sales = await Sale.find({ shop: req.shopId })
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    if (!sales || sales.length === 0) {
      return res.status(200).json({
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
      "Discount",
      "GST",
      "Final Total",
      "Paid",
      "Due",
    ];

    // Build CSV rows
    const rows = sales.map((s) => [
      s._id.toString().slice(-6),
      s.customer ? `"${String(s.customer.name || "").replace(/"/g, '""')}"` : '"Walk-in Customer"',
      s.customer?.phone || "N/A",
      new Date(s.createdAt).toLocaleString("en-IN"),
      Number(s.subtotal || 0).toFixed(2),
      Number(s.discount || 0).toFixed(2),
      Number(s.gst || 0).toFixed(2),
      Number(s.finalTotal || s.total || 0).toFixed(2),
      Number(s.paid || 0).toFixed(2),
      Number(s.due || 0).toFixed(2),
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

/**
 * XLSX Export - Sales Report
 * GET /api/export/sales/xlsx
 */
router.get("/sales/xlsx", async (req, res) => {
  try {
    const sales = await Sale.find({ shop: req.shopId })
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    if (!sales || sales.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No sales data to export",
      });
    }

    // Format data for Excel
    const sheetData = sales.map((s) => ({
      "Sale ID": s._id.toString().slice(-6),
      "Customer Name": s.customer?.name || "Walk-in Customer",
      "Phone": s.customer?.phone || "N/A",
      "Date": new Date(s.createdAt).toLocaleString("en-IN"),
      "Subtotal": Number(s.subtotal || 0).toFixed(2),
      "Discount": Number(s.discount || 0).toFixed(2),
      "GST": Number(s.gst || 0).toFixed(2),
      "Final Total": Number(s.finalTotal || s.total || 0).toFixed(2),
      "Paid": Number(s.paid || 0).toFixed(2),
      "Due": Number(s.due || 0).toFixed(2),
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
      { wch: 10 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

    // Stream to response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");

    // Write to buffer and send
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    res.send(wbout);
  } catch (error) {
    console.error("XLSX export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate XLSX report",
      error: error.message,
    });
  }
});

/**
 * Full Database Backup - JSON
 * GET /api/export/full-backup
 */
router.get("/full-backup", async (req, res) => {
  try {
    const customers = await Customer.find({ shop: req.shopId }).lean();
    const sales = await Sale.find({ shop: req.shopId })
      .populate("customer", "name phone")
      .lean();
    const medicines = await Medicine.find({ shop: req.shopId }).lean();
    const settings = await Setting.findOne().lean();

    const backup = {
      exportDate: new Date().toISOString(),
      customers: customers || [],
      sales: sales || [],
      medicines: medicines || [],
      settings: settings || {},
      totalRecords: {
        customers: customers?.length || 0,
        sales: sales?.length || 0,
        medicines: medicines?.length || 0,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=pharmatrack-backup-${new Date().toISOString().split("T")[0]}.json`
    );
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
