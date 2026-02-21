#!/bin/bash
# Multi-Tenant Conversion: Quick Checklist

# ============================================================================
# ✅ PHASE 0: VERIFY MODELS (Should Be Done)
# ============================================================================

# Check Shop model exists
grep -l "shopName" server/models/Shop.js && echo "✅ Shop model created"

# Check Customer has shop reference
grep -l "shop:" server/models/Customer.js && echo "✅ Customer model updated"

# Check Sale has shop reference
grep -l "shop:" server/models/Sale.js && echo "✅ Sale model updated"

# Check Medicine has shop reference
grep -l "shop:" server/models/Medicine.js && echo "✅ Medicine model updated"


# ============================================================================
# ⏳ PHASE 1: CREATE USER MODEL (Do This First)
# ============================================================================

# If User model doesn't exist, create it:
# File: server/models/User.js
# 
# const userSchema = new mongoose.Schema({
#   name: String,
#   email: { type: String, unique: true, required: true },
#   password: String,
#   shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
#   role: { type: String, enum: ["owner", "admin", "manager", "cashier"], default: "cashier" },
#   isActive: Boolean,
#   createdAt: { type: Date, default: Date.now },
# });
# 
# userSchema.index({ shop: 1, email: 1, unique: true });
# module.exports = mongoose.model("User", userSchema);

echo "[ ] Step 1.1: Create server/models/User.js with shop reference"


# ============================================================================
# ⏳ PHASE 2: UPDATE AUTH CONTROLLER (Do This Second)
# ============================================================================

# Update your login/signup controller to include shopId in JWT:
# 
# const token = jwt.sign(
#   {
#     userId: user._id,
#     email: user.email,
#     shopId: user.shop.toString(),  // ← ADD THIS LINE
#     role: user.role,
#   },
#   process.env.JWT_SECRET,
#   { expiresIn: "7d" }
# );

echo "[ ] Step 2.1: Update auth controller - add shopId to JWT payload"
echo "[ ] Step 2.2: Test: login, check token in localStorage contains shopId"


# ============================================================================
# ⏳ PHASE 3: UPDATE ALL ROUTE HANDLERS (Core Work)
# ============================================================================

echo ""
echo "✋ CRITICAL: Update these files with shop filter in ALL queries:"
echo ""
echo "[ ] Step 3.1: server/routes/customerRoutes.js"
echo "    - findAll: Customer.find({ shop: req.shopId })"
echo "    - findById: Customer.findOne({ _id: id, shop: req.shopId })"
echo "    - create: new Customer({ shop: req.shopId, ... })"
echo "    - update: findOneAndUpdate({ _id: id, shop: req.shopId }, ...)"
echo "    - delete: findOneAndDelete({ _id: id, shop: req.shopId })"
echo ""
echo "[ ] Step 3.2: server/routes/saleRoutes.js"
echo "    - findAll: Sale.find({ shop: req.shopId })"
echo "    - stats: aggregate [{ \$match: { shop: req.shopId } }]"
echo "    - create: new Sale({ shop: req.shopId, ... })"
echo "    - update: findOneAndUpdate({ _id: id, shop: req.shopId }, ...)"
echo "    - delete: findOneAndDelete({ _id: id, shop: req.shopId })"
echo ""
echo "[ ] Step 3.3: server/routes/medicineRoutes.js"
echo "    - findAll: Medicine.find({ shop: req.shopId })"
echo "    - findById: Medicine.findOne({ _id: id, shop: req.shopId })"
echo "    - create: new Medicine({ shop: req.shopId, ... })"
echo "    - update: findOneAndUpdate({ _id: id, shop: req.shopId }, ...)"
echo "    - delete: findOneAndDelete({ _id: id, shop: req.shopId })"
echo ""
echo "[ ] Step 3.4: server/routes/inventoryRoutes.js"
echo "[ ] Step 3.5: server/routes/invoiceRoutes.js"
echo "[ ] Step 3.6: server/routes/creditRoutes.js (if exists)"


# ============================================================================
# ⏳ PHASE 4: UPDATE FRONTEND API CALLS
# ============================================================================

echo ""
echo "[ ] Step 4.1: assets/js/api.js"
echo "    Add auth header to ALL fetch calls:"
echo "    const token = localStorage.getItem('ptp_token');"
echo "    const headers = token ? { 'Authorization': \`Bearer \${token}\` } : {};"
echo "    fetch(url, { headers, ... })"
echo ""
echo "[ ] Step 4.2: Update assets/js/dashboard.js - add auth headers"
echo "[ ] Step 4.3: Update assets/js/login.js - add auth headers"
echo "[ ] Step 4.4: Update assets/js/sales.js - add auth headers"


# ============================================================================
# ⏳ PHASE 5: DATA MIGRATION
# ============================================================================

echo ""
echo "[ ] Step 5.1: Run migration script"
echo "    Command: npm run migrate"
echo "    or: node server/migrations/addShopReference.js"
echo ""
echo "[ ] Step 5.2: Verify in MongoDB:"
echo "    - All customers have 'shop' field set"
echo "    - All sales have 'shop' field set"
echo "    - All medicines have 'shop' field set"
echo "    - Check MongoDB Compass or: db.customers.find({ shop: { \$exists: false } })"


# ============================================================================
# ⏳ PHASE 6: CREATE SHOP MANAGEMENT ROUTES
# ============================================================================

echo ""
echo "[ ] Step 6.1: Create server/routes/shopRoutes.js"
echo "    GET /:shopId - Get shop info"
echo "    PUT /:shopId - Update shop"
echo "    GET /:shopId/stats - Revenue, customer count, product count"
echo ""


# ============================================================================
# ✅ PHASE 7: VERIFICATION & TESTING
# ============================================================================

echo ""
echo "=== TESTING CHECKLIST ==="
echo ""
echo "[ ] Test 7.1: Login and verify token"
echo "    - Check localStorage has ptp_token"
echo "    - Decode token (jwt.io) and verify shopId present"
echo ""
echo "[ ] Test 7.2: Shop A isolation"
echo "    - Login as Shop A user"
echo "    - Create customer 'John' with phone '8888888888'"
echo "    - Verify customer visible in Shop A dashboard"
echo ""
echo "[ ] Test 7.3: Shop B isolation"
echo "    - Login as Shop B user"
echo "    - Attempt to search for 'John' by phone"
echo "    - Verify NOT visible (data isolated)"
echo "    - Create own 'John' with same phone '8888888888'"
echo "    - Verify both 'Johns' exist (different shops)"
echo ""
echo "[ ] Test 7.4: Cross-shop tampering"
echo "    - Get Shop B customer ID"
echo "    - While logged into Shop A"
echo "    - Try: GET /api/customers/[shopBCustomerId]"
echo "    - Verify returns 404 (ownership verified)"
echo ""
echo "[ ] Test 7.5: API isolation"
echo "    - Postman: GET /api/customers (with Shop A token)"
echo "    - Verify only Shop A customers returned"
echo "    - Repeat with Shop B token"
echo "    - Verify only Shop B customers returned"
echo ""


# ============================================================================
# 📊 SUMMARY
# ============================================================================

echo ""
echo "============================================================"
echo "MULTI-TENANT CONVERSION CHECKLIST"
echo "============================================================"
echo ""
echo "Quick Summary:"
echo "---"
echo "Phase 1: Create User model with shop reference"
echo "Phase 2: Add shopId to JWT payload in auth controller"
echo "Phase 3: ADD SHOP FILTER TO ALL ROUTE QUERIES ← CRITICAL"
echo "Phase 4: Add auth headers to all frontend API calls"
echo "Phase 5: Run migration (assign existing data to Legacy Shop)"
echo "Phase 6: Create Shop management routes"
echo "Phase 7: Test cross-shop isolation"
echo ""
echo "⚠️  CRITICAL: Phase 3 (route updates) must be completed"
echo "   before data isolation will work. Without shop filtering,"
echo "   all shops will see all data."
echo ""
echo "📚 Reference Files:"
echo "   - MULTI-TENANT-IMPLEMENTATION-GUIDE.js (detailed steps)"
echo "   - server/routes/SAMPLE-MULTI-TENANT-ROUTES.js (code examples)"
echo "   - server/migrations/addShopReference.js (migration script)"
echo "============================================================"
