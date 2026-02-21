/**
 * MIGRATION SCRIPT for Multi-Tenant Conversion
 * Assigns existing records without shop reference to a legacy shop
 * 
 * Usage: node server/migrations/addShopReference.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Shop = require("../models/Shop");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Step 1: Create or find legacy shop
    let legacyShop = await Shop.findOne({ shopName: "Legacy Shop" });

    if (!legacyShop) {
      const placeholderEmail = `legacy.${Date.now()}@local`;
      legacyShop = await Shop.create({
        shopName: "Legacy Shop",
        ownerName: "Legacy Admin",
        email: placeholderEmail,
        subscriptionStatus: "active",
      });
      console.log("✅ Created Legacy Shop:", legacyShop._id);
    } else {
      console.log("✅ Using existing Legacy Shop:", legacyShop._id);
    }

    // Step 2: Update customers without shop reference
    const customersWithoutShop = await Customer.find({ shop: { $exists: false } });
    if (customersWithoutShop.length > 0) {
      await Customer.updateMany(
        { shop: { $exists: false } },
        { $set: { shop: legacyShop._id } }
      );
      console.log(`✅ Updated ${customersWithoutShop.length} customers with shop reference`);
    } else {
      console.log("✅ No customers needed updating");
    }

    // Step 3: Update sales without shop reference
    const salesWithoutShop = await Sale.find({ shop: { $exists: false } });
    if (salesWithoutShop.length > 0) {
      await Sale.updateMany(
        { shop: { $exists: false } },
        { $set: { shop: legacyShop._id } }
      );
      console.log(`✅ Updated ${salesWithoutShop.length} sales with shop reference`);
    } else {
      console.log("✅ No sales needed updating");
    }

    // Step 4: Update medicines without shop reference
    const medicinesWithoutShop = await Medicine.find({ shop: { $exists: false } });
    if (medicinesWithoutShop.length > 0) {
      await Medicine.updateMany(
        { shop: { $exists: false } },
        { $set: { shop: legacyShop._id } }
      );
      console.log(`✅ Updated ${medicinesWithoutShop.length} medicines with shop reference`);
    } else {
      console.log("✅ No medicines needed updating");
    }

    // Step 5: Verify migration
    const customerCount = await Customer.countDocuments({ shop: legacyShop._id });
    const saleCount = await Sale.countDocuments({ shop: legacyShop._id });
    const medicineCount = await Medicine.countDocuments({ shop: legacyShop._id });

    console.log("\n📊 Migration Summary:");
    console.log(`   - Customers in Legacy Shop: ${customerCount}`);
    console.log(`   - Sales in Legacy Shop: ${saleCount}`);
    console.log(`   - Medicines in Legacy Shop: ${medicineCount}`);
    console.log(`   - Legacy Shop ID: ${legacyShop._id}`);

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update your auth middleware to extract shopId from JWT payload");
    console.log("   2. Replace your existing routes with multi-tenant versions");
    console.log("   3. Create Shop management routes (create, update, delete)");
    console.log("   4. Test that Shop A users cannot access Shop B data");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
