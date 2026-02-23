const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authService = require("./core/authService");
const customerService = require("./core/customerService");
const inventoryService = require("./core/inventoryService");
const salesService = require("./core/salesService");
const analyticsService = require("./core/analyticsService");
const backupService = require("./core/backupService");
const demoService = require("./core/demoService");
const db = require("./core/database");
const whatsappService = require("./core/whatsappService");
const dashboardRoutes = require("./routes/dashboard");
const exportRoutes = require("./routes/export");

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS Configuration for production compatibility
// Allows localhost:5000 for local development and all origins for Render deployment
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl requests, etc.)
      if (!origin) return callback(null, true);

      // Allow localhost for local development
      if (
        origin === "/" ||
        origin === "http://localhost:5000" ||
        origin === "http://localhost:3000" ||
        origin === "http://127.0.0.1:5000" ||
        origin === "http://127.0.0.1:3000"
      ) {
        return callback(null, true);
      }

      // Allow all origins for production deployment (Render, etc.)
      // Comment this out if you need more restrictive CORS policies
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", dashboardRoutes);
app.use("/api/export", exportRoutes);

// Serve UI static files from project root `ui` directory.
// IMPORTANT: API routes are registered above so they are not
// accidentally shadowed by static file serving.
app.use(express.static(path.join(__dirname, "ui", "pages")));

app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/backups", express.static(path.join(__dirname, "backups")));
app.use("/exports", express.static(path.join(__dirname, "exports")));

function safeHandler(handler) {
  return (req, res) => {
    const handleError = (error) => {
      console.error(error);
      const message = error?.message || "Internal server error";
      const isClientError = !String(message).toLowerCase().includes("sqlite") && message !== "Internal server error";
      res.status(isClientError ? 400 : 500).json({ success: false, message });
    };

    try {
      const result = handler(req, res);
      if (result && typeof result.then === "function") {
        result.catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  };
}

app.post("/api/auth/login", safeHandler((req, res) => {
  const { username, password } = req.body;
  const result = authService.login(username, password);
  res.json({ success: true, data: result });
}));

app.post("/api/auth/signup", safeHandler((req, res) => {
  const { username, password, confirmPassword } = req.body;
  const result = authService.signup(username, password, confirmPassword);
  res.json({ success: true, message: "Signup successful", data: result });
}));

app.get("/api/settings", safeHandler((req, res) => {
  res.json({ success: true, data: db.getSettings() });
}));

app.put("/api/settings", safeHandler((req, res) => {
  const {
    store_name,
    owner_name,
    shop_address,
    phone_number,
    whatsapp_number,
    gst_number,
    invoice_prefix,
    currency,
  } = req.body;

  db.execute(
    `UPDATE settings SET
       store_name = ?,
       owner_name = ?,
       shop_address = ?,
       phone_number = ?,
       whatsapp_number = ?,
       gst_number = ?,
       invoice_prefix = ?,
       currency = ?
     WHERE id = 1`,
    [
      store_name || "PharmaTrackPro Store",
      owner_name || null,
      shop_address || null,
      phone_number || null,
      whatsapp_number || null,
      gst_number || null,
      invoice_prefix || "INV",
      currency || "INR",
    ]
  );

  res.json({ success: true, message: "Settings updated successfully" });
}));

app.get("/api/customers", safeHandler((req, res) => {
  const q = req.query.q || "";
  res.json({ success: true, data: customerService.searchCustomers(q) });
}));

app.post("/api/customers", safeHandler((req, res) => {
  const { name, phone } = req.body;
  const customer = customerService.addCustomer(name, phone);
  res.json({ success: true, data: customer });
}));

app.get("/api/customers/credit", safeHandler((req, res) => {
  res.json({ success: true, data: customerService.listCreditCustomers() });
}));

app.get("/api/credits", safeHandler((req, res) => {
  const credits = customerService.listCreditCustomers();
  const storeName = db.getSettings()?.store_name || "PharmaTrackPro Store";
  
  const rows = (credits || []).map((c) => {
    const totalAmount = Number(c.total_purchases || 0);
    const outstanding = Number(c.outstanding_credit || 0);
    const paid = Math.max(0, totalAmount - outstanding);
    
    const waMessage = whatsappService.buildCreditReminderMessage(c, storeName);
    const waUrl = waMessage ? waMessage.url : null;
    
    return {
      id: c.id,
      customer: { id: c.id, name: c.name, phone: c.phone || "" },
      phone: c.phone || "",
      medicines: [],
      totalAmount,
      paid,
      due: outstanding,
      status: outstanding > 0 ? "pending" : "paid",
      createdAt: c.last_purchase_date || null,
      whatsappUrl: waUrl,
      whatsappMessage: waMessage?.message || null,
    };
  });
  
  res.json({ success: true, data: { storeName, rows } });
}));

app.get("/api/medicines", safeHandler((req, res) => {
  const q = req.query.q || "";
  res.json({ success: true, data: inventoryService.searchMedicines(q) });
}));

app.post("/api/medicines", safeHandler((req, res) => {
  const data = inventoryService.addMedicine(req.body);
  res.json({ success: true, data });
}));

app.put("/api/medicines/:id/stock", safeHandler((req, res) => {
  const data = inventoryService.updateStock(Number(req.params.id), Number(req.body.stock_quantity || 0));
  res.json({ success: true, data });
}));

app.post("/api/sales", safeHandler((req, res) => {
  // Normalize payload: handle both 'customer' and 'customer_id' keys
  const normalized = { ...req.body };
  if (normalized.customer && !normalized.customer_id) {
    normalized.customer_id = normalized.customer;
  }
  // Normalize items: handle both 'medicine' and 'medicine_id' keys
  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map(item => {
      if (item.medicine && !item.medicine_id) {
        return { ...item, medicine_id: item.medicine };
      }
      return item;
    });
  }
  const data = salesService.createSale(normalized);
  res.json({ success: true, data });
}));

app.get("/api/sales/:id", safeHandler((req, res) => {
  const sale = salesService.getSaleById(Number(req.params.id));
  res.json({ success: true, data: sale });
}));

app.get("/api/dashboard/cards", (req, res) => {
  try {
    const data = analyticsService.getBusinessSnapshot();
    res.json({ success: true, data });
  } catch (_err) {
    console.error("dashboard/cards error:", _err);
    res.json({
      success: true,
      data: {
        todayRevenue: 0,
        todayProfit: 0,
        creditOutstanding: 0,
        lowStockCount: 0,
        expiryAlert: 0,
      },
    });
  }
});

app.get("/api/dashboard/monthly-revenue", (req, res) => {
  try {
    const data = analyticsService.getMonthlyRevenueComparison();
    res.json({ success: true, data });
  } catch (_err) {
    console.error("dashboard/monthly-revenue error:", _err);
    res.json({ success: true, data: { currentMonth: 0, lastMonth: 0, growthPercent: 0, direction: "up" } });
  }
});

app.get("/api/dashboard/top-medicines", (req, res) => {
  try {
    const data = analyticsService.getTopSellingMedicines();
    res.json({ success: true, data });
  } catch (_err) {
    console.error("dashboard/top-medicines error:", _err);
    res.json({ success: true, data: [] });
  }
});

app.get("/api/dashboard/stats", (req, res) => {
  let monthly = { currentMonth: 0, lastMonth: 0 };
  let topRaw = [];
  try { monthly = analyticsService.getMonthlyRevenueComparison(); } catch (_e) { console.error("stats monthly error:", _e); }
  try { topRaw = analyticsService.getTopSellingMedicines() || []; } catch (_e) { console.error("stats top error:", _e); }

  const topMedicines = topRaw.map((row) => ({
    name: row.name,
    totalSold: Number(row.totalSold ?? row.total_quantity ?? 0),
  }));

  res.json({
    success: true,
    data: {
      currentMonthRevenue: Number(monthly.currentMonthRevenue ?? monthly.currentMonth ?? 0),
      lastMonthRevenue: Number(monthly.lastMonthRevenue ?? monthly.lastMonth ?? 0),
      topMedicines,
    },
  });
});

app.post("/api/backup/create", safeHandler((req, res) => {
  const backup = backupService.createBackup();
  res.json({ success: true, data: backup });
}));

app.get("/api/backup/list", safeHandler((req, res) => {
  const backupsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
  res.json({ success: true, data: files });
}));

app.post("/api/backup/restore", safeHandler((req, res) => {
  const { fileName } = req.body;
  const restored = backupService.restoreBackup(fileName);
  res.json({ success: true, data: restored });
}));

app.get("/api/export/sales/csv", safeHandler((req, res) => {
  const file = salesService.exportSalesCSV();
  res.json({ success: true, data: file });
}));

app.get("/api/export/sales/xlsx", safeHandler((req, res) => {
  const file = salesService.exportSalesXLSX();
  res.json({ success: true, data: file });
}));

app.post("/api/whatsapp/send-reminder", safeHandler((req, res) => {
  const { customerId } = req.body;
  if (!customerId) throw new Error("customerId is required");
  
  const customer = db.queryOne("SELECT * FROM customers WHERE id = ?", [customerId]);
  if (!customer) throw new Error("Customer not found");
  
  const storeName = db.getSettings()?.store_name || "PharmaTrackPro Store";
  const message = whatsappService.buildCreditReminderMessage(customer, storeName);
  
  if (!message?.url) throw new Error("Invalid phone number");
  
  whatsappService.logWhatsAppMessage(customerId, "credit_reminder", message.message, customer.phone, "sent");
  
  res.json({ 
    success: true, 
    data: { 
      message: "WhatsApp URL generated successfully", 
      url: message.url,
      phone: customer.phone 
    } 
  });
}));

app.get("/api/whatsapp/logs", safeHandler((req, res) => {
  const logs = db.queryAll(
    `SELECT wl.id, wl.customer_id, c.name AS customer_name, wl.message_type, 
            wl.phone_number, wl.status, wl.created_at
     FROM whatsapp_log wl
     LEFT JOIN customers c ON c.id = wl.customer_id
     ORDER BY wl.created_at DESC
     LIMIT 100`
  );
  res.json({ success: true, data: logs });
}));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

demoService.seedDemoDataIfEmpty();

app.listen(PORT, () => {
  console.log(`PharmaTrackPro ERP running on http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});
