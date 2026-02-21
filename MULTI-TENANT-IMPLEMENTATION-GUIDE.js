/**
 * MULTI-TENANT IMPLEMENTATION CHECKLIST & REFACTORING GUIDE
 * 
 * This guide walks through converting your existing pharmacy app to multi-tenant
 * with complete data isolation. Follow these steps in order.
 */

// ============================================================================
// ✅ COMPLETED TASKS (Already Done)
// ============================================================================

/*
1. ✅ Create Shop model (server/models/Shop.js)
   - Tenant identity with subscription info
   - Fields: shopName, ownerEmail, subscriptionStatus, apiKey, maxUsers, maxProducts

2. ✅ Update Customer model (server/models/Customer.js)
   - Added: shop ObjectId reference (required)
   - Changed: phone/customerId from unique to compound index { shop, field }
   - BREAKING: Existing records have no shop reference

3. ✅ Update Sale model (server/models/Sale.js)
   - Added: shop ObjectId reference (required)
   - Added: Index { shop, createdAt }

4. ✅ Update Medicine model (server/models/Medicine.js)
   - Added: shop ObjectId reference (required)
   - Added: Index { shop, name }

5. ✅ Update authMiddleware.js
   - Now extracts shopId from JWT payload
   - Sets req.shopId for all protected routes

6. ✅ Production hardening (server.js)
   - Added helmet, compression, error handling, graceful shutdown
*/

// ============================================================================
// 📋 NEXT STEPS (In Priority Order)
// ============================================================================

/*
STEP 1: Create User Model (if doesn't exist)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: server/models/User.js

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  
  // CRITICAL for multi-tenant
  shop: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Shop", 
    required: true 
  },
  
  // Optional: role-based access control
  role: { 
    type: String, 
    enum: ["owner", "admin", "manager", "cashier"],
    default: "cashier"
  },
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ shop: 1, email: 1, unique: true });


STEP 2: Update Auth Controller (Login/Signup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: server/controllers/authController.js / core/authService.js

When issuing JWT on login, INCLUDE shopId:

// BEFORE (single-tenant - no shop in token)
const token = jwt.sign(
  {
    userId: user._id,
    email: user.email,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// AFTER (multi-tenant - shop included)
const token = jwt.sign(
  {
    userId: user._id,
    email: user.email,
    shopId: user.shop.toString(), // CRITICAL: Add this
    role: user.role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);


STEP 3: Update All Route Handlers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EVERY route that queries Customer, Sale, or Medicine, add shop filter:

// BEFORE (single-tenant - data merged across shops)
const customers = await Customer.find();
const sales = await Sale.find();
const medicines = await Medicine.find();

// AFTER (multi-tenant - isolated per shop)
const customers = await Customer.find({ shop: req.shopId });
const sales = await Sale.find({ shop: req.shopId });
const medicines = await Medicine.find({ shop: req.shopId });

Files to Update:
  - server/routes/customerRoutes.js (12+ methods)
  - server/routes/saleRoutes.js (12+ methods)
  - server/routes/medicineRoutes.js (6+ methods)
  - server/routes/inventoryRoutes.js (all methods)
  - server/routes/invoiceRoutes.js (all methods)
  - assets/js/api.js (frontend calls - add Authorization header)

Critical Pattern:
  // When CREATING: Always assign to current shop
  const sale = new Sale({
    shop: req.shopId, // Always set
    customer: customerId,
    items: [...],
  });

  // When READING: Always filter by shop
  const sale = await Sale.findOne({
    _id: saleId,
    shop: req.shopId, // Verify ownership
  });

  // When UPDATING: Verify shop ownership first
  const sale = await Sale.findOneAndUpdate(
    { _id: saleId, shop: req.shopId },
    updateData,
    { new: true }
  );

  // When DELETING: Verify shop ownership first
  const sale = await Sale.findOneAndDelete({
    _id: saleId,
    shop: req.shopId,
  });


STEP 4: Run Data Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Command: npm run migrate
(or manually: node server/migrations/addShopReference.js)

What it does:
  - Creates "Legacy Shop" as default tenant
  - Assigns all existing records (customers, sales, medicines) to Legacy Shop
  - Verifies all records now have shop reference
  - Prints migration report

This MUST be done before queries with shop filter will work.


STEP 5: Create Shop Management Routes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: server/routes/shopRoutes.js

Create endpoints for:
  - GET /api/shops/:shopId (get current shop info)
  - PUT /api/shops/:shopId (update shop name, settings)
  - POST /api/shops (create new shop - OWNER only)
  - GET /api/shops/:shopId/stats (revenue, customers, products)
  - POST /api/shops/:shopId/upgrade (change subscription plan)

All routes must verify shop access:
  router.get("/:shopId", authMiddleware, verifyShopAccess, async (req, res) => {
    const shop = await Shop.findById(req.shopId);
    res.json({ success: true, data: shop });
  });


STEP 6: Update Frontend API Calls
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: assets/js/api.js

Ensure ALL fetch calls include Authorization header from Step 2:

// Helper function
function getAuthHeaders() {
  const token = localStorage.getItem("ptp_token");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

// Use in all API calls
const response = await fetch(
  "/api/customers",
  {
    method: "GET",
    headers: getAuthHeaders(),
  }
);


STEP 7: Testing Multi-Tenant Isolation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Scenarios:
  1. Create 2 shops in MongoDB
  2. Create users in each shop
  3. Log in as User A (Shop A)
  4. Create customer "John" in Shop A
  5. Log in as User B (Shop B)
  6. Verify "John" is NOT visible in Shop B
  7. Verify User A cannot access Shop B customers via API
  8. Verify User B cannot access Shop A data via API

Success Criteria:
  ✅ Each shop sees only its data
  ✅ Cross-shop queries return empty/403 forbidden
  ✅ Customer phone "8888888888" exists in both shops if created
  ✅ Compound index prevents phone duplicate within same shop


STEP 8: Update package.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add migration script to package.json:

"scripts": {
  "start": "node server/server.js",
  "dev": "nodemon server/server.js",
  "migrate": "node server/migrations/addShopReference.js"
}
*/

// ============================================================================
// 🚨 CRITICAL IMPLEMENTATION DETAILS
// ============================================================================

/*
1. SHOP ISOLATION PATTERN
   Every query must follow: { shop: req.shopId, ...otherFilters }
   This is your DATA ISOLATION LAYER - without it, users see all data

2. JWT PAYLOAD REQUIREMENT
   Token MUST contain shopId: jwt.sign({ ..., shopId: user.shop }, secret)
   Without shopId in token, req.shopId will be undefined in routes

3. COMPOUND INDEXES ARE CRITICAL
   - Prevents duplicate phone numbers WITHIN a shop
   - Allows same phone number across different shops
   - Must run db migration before using new schema

4. MIGRATION DEPENDENCY
   Old data (customers, sales, medicines) cannot be queried with shop filter
   until migration script assigns them to a shop. Do this BEFORE testing.

5. USER-SHOP MAPPING
   Users belong to shops via user.shop ObjectId reference
   Multiple users can be in same shop with different roles
   One user cannot belong to multiple shops (in this design)

6. BREAKING CHANGE: UNIQUE INDEXES
   Old unique indexes: { phone: 1, unique: true }
   New compound indexes: { shop: 1, phone: 1, unique: true }
   These are NOT backward compatible - migration required
*/

// ============================================================================
// 📊 VERIFICATION CHECKLIST (Before Going Live)
// ============================================================================

/*
[ ] Step 1: User model created with shop reference
[ ] Step 2: Auth controller updated to include shopId in JWT
[ ] Step 3: All route handlers filter by req.shopId
[ ] Step 4: Migration script run successfully
[ ] Step 5: Shop management routes created and tested
[ ] Step 6: Frontend API calls include Authorization headers
[ ] Step 7: Multi-tenant isolation verified with cross-shop tests
[ ] Step 8: package.json updated with migrate script
[ ] Verified: Shop A customers not visible to Shop B
[ ] Verified: Compound indexes working (same phone allowed across shops)
[ ] Verified: Token payload includes shopId
[ ] Verified: req.shopId available in all protected routes
*/

module.exports = {
  todo: "This is a reference guide - not meant to be imported",
};
