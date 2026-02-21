const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "pharmatrackpro.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function init() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        store_name TEXT NOT NULL DEFAULT 'PharmaTrackPro Store',
        owner_name TEXT,
        shop_address TEXT,
        phone_number TEXT,
        whatsapp_number TEXT,
        gst_number TEXT,
        invoice_prefix TEXT DEFAULT 'INV',
        currency TEXT DEFAULT 'INR'
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        total_purchases REAL DEFAULT 0,
        outstanding_credit REAL DEFAULT 0,
        last_purchase_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        mrp REAL NOT NULL,
        selling_price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        expiry_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        subtotal REAL NOT NULL,
        overall_discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        gst_percent REAL DEFAULT 0,
        gst_amount REAL DEFAULT 0,
        final_total REAL NOT NULL,
        paid REAL NOT NULL,
        due REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        medicine_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        discount_percent REAL DEFAULT 0,
        line_total REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (medicine_id) REFERENCES medicines(id)
      );
    `);

    const settings = db.prepare("SELECT id FROM settings WHERE id = 1").get();
    if (!settings) {
      db.prepare("INSERT INTO settings (id, store_name) VALUES (1, ?)").run("PharmaTrackPro Store");
    }

    const user = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
    if (!user) {
      db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");
    }

    const medicineColumns = db.prepare("PRAGMA table_info(medicines)").all();
    const hasExpiry = medicineColumns.some((column) => column.name === "expiry_date");
    if (!hasExpiry) {
      db.exec("ALTER TABLE medicines ADD COLUMN expiry_date TEXT");
    }

    // Migrate settings table to add new columns
    const settingsColumns = db.prepare("PRAGMA table_info(settings)").all();
    const columnNames = settingsColumns.map((col) => col.name);
    
    if (!columnNames.includes("owner_name")) {
      db.exec("ALTER TABLE settings ADD COLUMN owner_name TEXT");
    }
    if (!columnNames.includes("shop_address")) {
      db.exec("ALTER TABLE settings ADD COLUMN shop_address TEXT");
    }
    if (!columnNames.includes("phone_number")) {
      db.exec("ALTER TABLE settings ADD COLUMN phone_number TEXT");
    }
    if (!columnNames.includes("whatsapp_number")) {
      db.exec("ALTER TABLE settings ADD COLUMN whatsapp_number TEXT");
    }
    if (!columnNames.includes("gst_number")) {
      db.exec("ALTER TABLE settings ADD COLUMN gst_number TEXT");
    }
    if (!columnNames.includes("invoice_prefix")) {
      db.exec("ALTER TABLE settings ADD COLUMN invoice_prefix TEXT DEFAULT 'INV'");
    }
    if (!columnNames.includes("currency")) {
      db.exec("ALTER TABLE settings ADD COLUMN currency TEXT DEFAULT 'INR'");
    }
  } catch (error) {
    console.error("DB init error:", error);
  }
}

init();

function queryAll(sql, params = []) {
  try {
    return db.prepare(sql).all(...params);
  } catch (error) {
    console.error("queryAll error:", error);
    throw error;
  }
}

function queryOne(sql, params = []) {
  try {
    return db.prepare(sql).get(...params);
  } catch (error) {
    console.error("queryOne error:", error);
    throw error;
  }
}

function execute(sql, params = []) {
  try {
    return db.prepare(sql).run(...params);
  } catch (error) {
    console.error("execute error:", error);
    throw error;
  }
}

function runTransaction(callback) {
  try {
    const trx = db.transaction(callback);
    return trx();
  } catch (error) {
    console.error("transaction error:", error);
    throw error;
  }
}

function getSettings() {
  return queryOne("SELECT * FROM settings WHERE id = 1") || { store_name: "PharmaTrackPro Store" };
}

function updateStoreName(storeName) {
  return execute("UPDATE settings SET store_name = ? WHERE id = 1", [storeName]);
}

module.exports = {
  db,
  dbPath,
  queryAll,
  queryOne,
  execute,
  runTransaction,
  getSettings,
  updateStoreName,
};
