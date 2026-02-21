const db = require("./database");

function searchCustomers(query = "") {
  try {
    const q = `%${String(query).trim()}%`;
    return db.queryAll(
      `SELECT id, name, phone, total_purchases, outstanding_credit, last_purchase_date
       FROM customers
       WHERE name LIKE ? OR IFNULL(phone, '') LIKE ?
       ORDER BY name ASC`,
      [q, q]
    );
  } catch (error) {
    console.error("customerService.searchCustomers error:", error);
    throw error;
  }
}

function addCustomer(name, phone) {
  try {
    if (!name) throw new Error("Customer name is required");
    const result = db.execute("INSERT INTO customers (name, phone) VALUES (?, ?)", [name.trim(), (phone || "").trim()]);
    return db.queryOne("SELECT * FROM customers WHERE id = ?", [result.lastInsertRowid]);
  } catch (error) {
    console.error("customerService.addCustomer error:", error);
    throw error;
  }
}

function updateCustomerMetrics(customerId, finalTotal, due, saleDateISO) {
  try {
    db.execute(
      `UPDATE customers
       SET total_purchases = IFNULL(total_purchases, 0) + ?,
           outstanding_credit = IFNULL(outstanding_credit, 0) + ?,
           last_purchase_date = ?
       WHERE id = ?`,
      [Number(finalTotal || 0), Number(due || 0), saleDateISO, Number(customerId)]
    );
  } catch (error) {
    console.error("customerService.updateCustomerMetrics error:", error);
    throw error;
  }
}

function listCreditCustomers() {
  try {
    return db.queryAll(
      `SELECT id, name, phone, total_purchases, outstanding_credit, last_purchase_date
       FROM customers
       WHERE IFNULL(outstanding_credit, 0) > 0
       ORDER BY outstanding_credit DESC`
    );
  } catch (error) {
    console.error("customerService.listCreditCustomers error:", error);
    throw error;
  }
}

module.exports = {
  searchCustomers,
  addCustomer,
  updateCustomerMetrics,
  listCreditCustomers,
};
