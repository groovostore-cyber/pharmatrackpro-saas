const db = require("./database");
const inventoryService = require("./inventoryService");
const customerService = require("./customerService");
const salesService = require("./salesService");

function seedDemoDataIfEmpty() {
  try {
    const medicineCount = db.queryOne("SELECT COUNT(*) AS c FROM medicines")?.c || 0;
    const customerCount = db.queryOne("SELECT COUNT(*) AS c FROM customers")?.c || 0;
    const salesCount = db.queryOne("SELECT COUNT(*) AS c FROM sales")?.c || 0;

    if (medicineCount > 0 || customerCount > 0 || salesCount > 0) {
      return { seeded: false, reason: "Database not empty" };
    }

    const meds = [
      { name: "Paracetamol 500mg", mrp: 25, selling_price: 22, stock_quantity: 120, expiry_date: "2027-12-31" },
      { name: "Azithromycin 250mg", mrp: 95, selling_price: 89, stock_quantity: 60, expiry_date: "2027-10-15" },
      { name: "Vitamin C Tablets", mrp: 120, selling_price: 110, stock_quantity: 80, expiry_date: "2028-01-31" },
      { name: "Cough Syrup", mrp: 78, selling_price: 72, stock_quantity: 40, expiry_date: "2027-08-20" },
      { name: "Antacid Gel", mrp: 140, selling_price: 132, stock_quantity: 25, expiry_date: "2027-07-01" },
    ];
    meds.forEach((m) => inventoryService.addMedicine(m));

    const c1 = customerService.addCustomer("Rahul Sharma", "9876543210");
    const c2 = customerService.addCustomer("Priya Nair", "9123456780");

    const allMeds = db.queryAll("SELECT * FROM medicines ORDER BY id ASC");
    if (allMeds.length >= 3) {
      salesService.createSale({
        customer_id: c1.id,
        overall_discount_percent: 5,
        gst_percent: 12,
        paid: 180,
        items: [
          { medicine_id: allMeds[0].id, quantity: 3, discount_percent: 0 },
          { medicine_id: allMeds[1].id, quantity: 1, discount_percent: 5 },
        ],
      });

      salesService.createSale({
        customer_id: c2.id,
        overall_discount_percent: 0,
        gst_percent: 5,
        paid: 90,
        items: [
          { medicine_id: allMeds[2].id, quantity: 1, discount_percent: 0 },
        ],
      });
    }

    return { seeded: true };
  } catch (error) {
    console.error("demoService.seedDemoDataIfEmpty error:", error);
    return { seeded: false, error: error.message };
  }
}

module.exports = {
  seedDemoDataIfEmpty,
};
