const db = require("./database");

function searchMedicines(query = "") {
  try {
    const q = `%${String(query).trim()}%`;
    return db.queryAll(
      `SELECT id, name, mrp, selling_price, stock_quantity, expiry_date,
              CASE WHEN stock_quantity < 10 THEN 1 ELSE 0 END AS is_low_stock
       FROM medicines
       WHERE name LIKE ?
       ORDER BY name ASC`,
      [q]
    );
  } catch (error) {
    console.error("inventoryService.searchMedicines error:", error);
    throw error;
  }
}

function addMedicine(payload = {}) {
  try {
    const name = String(payload.name || "").trim();
    const mrp = Number(payload.mrp || 0);
    const sellingPrice = Number(payload.selling_price || 0);
    const stock = Number(payload.stock_quantity || 0);
    const expiryDate = payload.expiry_date ? String(payload.expiry_date) : null;

    if (!name) throw new Error("Medicine name is required");
    if (mrp < 0 || sellingPrice < 0 || stock < 0) throw new Error("Invalid medicine values");

    const result = db.execute(
      `INSERT INTO medicines (name, mrp, selling_price, stock_quantity, expiry_date)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         mrp = excluded.mrp,
         selling_price = excluded.selling_price,
         stock_quantity = medicines.stock_quantity + excluded.stock_quantity,
         expiry_date = COALESCE(excluded.expiry_date, medicines.expiry_date)`,
      [name, mrp, sellingPrice, stock, expiryDate]
    );

    if (result.lastInsertRowid) {
      return db.queryOne("SELECT * FROM medicines WHERE id = ?", [result.lastInsertRowid]);
    }
    return db.queryOne("SELECT * FROM medicines WHERE name = ?", [name]);
  } catch (error) {
    console.error("inventoryService.addMedicine error:", error);
    throw error;
  }
}

function updateStock(medicineId, stockQuantity) {
  try {
    if (!medicineId || stockQuantity < 0) {
      throw new Error("Invalid stock update payload");
    }
    db.execute("UPDATE medicines SET stock_quantity = ? WHERE id = ?", [Number(stockQuantity), Number(medicineId)]);
    return db.queryOne("SELECT * FROM medicines WHERE id = ?", [Number(medicineId)]);
  } catch (error) {
    console.error("inventoryService.updateStock error:", error);
    throw error;
  }
}

module.exports = {
  searchMedicines,
  addMedicine,
  updateStock,
};
