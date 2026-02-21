/**
 * SAMPLE MULTI-TENANT ROUTE UPDATES
 * Shows how to implement data isolation by filtering all queries with shopId
 */

// ============================================================================
// MIDDLEWARE: Extract shopId from authenticated user (add to authMiddleware)
// ============================================================================

const extractShopMiddleware = (req, res, next) => {
  // Assuming JWT payload contains shopId from authentication
  req.shopId = req.user?.shopId;
  
  if (!req.shopId) {
    return res.status(401).json({ 
      success: false, 
      message: "Shop ID not found in token" 
    });
  }
  
  next();
};

// ============================================================================
// UPDATED CUSTOMER ROUTES (customerRoutes.js)
// ============================================================================

const express = require("express");
const Customer = require("../models/Customer");

const router = express.Router();

// GET all customers for a specific shop (ISOLATED)
router.get("/", extractShopMiddleware, async (req, res) => {
  try {
    // Filter by shop - data isolation
    const customers = await Customer.find({ shop: req.shopId })
      .select("_id name phone address customerId createdAt")
      .lean();

    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single customer by ID (ISOLATED)
router.get("/:id", extractShopMiddleware, async (req, res) => {
  try {
    // Verify customer belongs to this shop
    const customer = await Customer.findOne({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: "Customer not found" 
      });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE customer (ISOLATED)
router.post("/", extractShopMiddleware, async (req, res) => {
  try {
    const { name, phone, address, customerId } = req.body;

    // Check if phone already exists for this shop
    const existingCustomer = await Customer.findOne({
      shop: req.shopId,
      phone,
    });

    if (existingCustomer) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number already exists in your shop" 
      });
    }

    const customer = new Customer({
      shop: req.shopId, // Automatically assign shop
      name,
      phone,
      address,
      customerId,
    });

    await customer.save();
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE customer (ISOLATED)
router.put("/:id", extractShopMiddleware, async (req, res) => {
  try {
    // Ensure customer belongs to this shop before updating
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: "Customer not found" 
      });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE customer (ISOLATED)
router.delete("/:id", extractShopMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: "Customer not found" 
      });
    }

    res.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

// ============================================================================
// UPDATED SALES ROUTES (saleRoutes.js)
// ============================================================================

const Sale = require("../models/Sale");

const saleRouter = express.Router();

// GET all sales for shop (ISOLATED)
saleRouter.get("/", extractShopMiddleware, async (req, res) => {
  try {
    const sales = await Sale.find({ shop: req.shopId })
      .populate("customer", "name phone")
      .populate({
        path: "items.medicine",
        select: "name sellingPrice",
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET sales dashboard stats (SHOP-SPECIFIC)
saleRouter.get("/stats/overview", extractShopMiddleware, async (req, res) => {
  try {
    const stats = await Sale.aggregate([
      { $match: { shop: req.shopId } }, // Filter by shop first
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$finalTotal" },
          totalDue: { $sum: "$due" },
          totalPaid: { $sum: "$paid" },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: stats[0] || { totalSales: 0, totalDue: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE sale (ISOLATED)
saleRouter.post("/", extractShopMiddleware, async (req, res) => {
  try {
    const { customerId, items, subtotal, gst, discount, paid, due } = req.body;

    // Validate customer belongs to this shop
    if (customerId) {
      const customer = await Customer.findOne({
        _id: customerId,
        shop: req.shopId,
      });

      if (!customer) {
        return res.status(400).json({ 
          success: false, 
          message: "Customer not found in your shop" 
        });
      }
    }

    const sale = new Sale({
      shop: req.shopId, // Automatically assign shop
      customer: customerId || null,
      items,
      subtotal,
      gst,
      discount,
      finalTotal: subtotal + gst - discount,
      total: subtotal + gst - discount,
      paid,
      due,
    });

    await sale.save();
    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = saleRouter;

// ============================================================================
// AUTHENTICATION UPDATE (Add shopId to JWT payload)
// ============================================================================

// In your login/auth controller, when issuing JWT:
/*
const token = jwt.sign(
  {
    userId: user._id,
    shopId: user.shop, // Add shop reference to token
    email: user.email,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);
*/
