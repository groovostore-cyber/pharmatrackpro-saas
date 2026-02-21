/**
 * BEFORE & AFTER: Code Conversion Patterns
 * 
 * Use this to understand exactly what needs to change
 * in your existing code to support multi-tenancy
 */

// ============================================================================
// 1. JWT PAYLOAD (Login Controller)
// ============================================================================

// ❌ BEFORE: Single-tenant - no shop context
const token = jwt.sign(
  {
    userId: user._id,
    email: user.email,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// ✅ AFTER: Multi-tenant - includes shopId
const token = jwt.sign(
  {
    userId: user._id,
    email: user.email,
    shopId: user.shop.toString(), // ← ADD THIS
    role: user.role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);


// ============================================================================
// 2. AUTH MIDDLEWARE
// ============================================================================

// ❌ BEFORE: Only validates token
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false });
  
  req.user = jwt.verify(token, process.env.JWT_SECRET);
  next();
}

// ✅ AFTER: Validates token + extracts shopId
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false });
  
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.user = payload;
  req.shopId = payload.shopId; // ← ADD THIS
  next();
}


// ============================================================================
// 3. CUSTOMER ROUTES: GET ALL
// ============================================================================

// ❌ BEFORE: Returns ALL customers (global)
router.get("/", async (req, res) => {
  const customers = await Customer.find();
  res.json({ success: true, data: customers });
});

// ✅ AFTER: Returns only this shop's customers
router.get("/", async (req, res) => {
  const customers = await Customer.find({ shop: req.shopId }); // ← ADD FILTER
  res.json({ success: true, data: customers });
});


// ============================================================================
// 4. CUSTOMER ROUTES: GET BY ID
// ============================================================================

// ❌ BEFORE: Returns customer if exists (no ownership check)
router.get("/:id", async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ success: false });
  res.json({ success: true, data: customer });
});

// ✅ AFTER: Returns customer ONLY if belongs to this shop
router.get("/:id", async (req, res) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    shop: req.shopId, // ← VERIFY OWNERSHIP
  });
  if (!customer) return res.status(404).json({ success: false });
  res.json({ success: true, data: customer });
});


// ============================================================================
// 5. CUSTOMER ROUTES: CREATE
// ============================================================================

// ❌ BEFORE: Creates customer in global database
router.post("/", async (req, res) => {
  const customer = new Customer({
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
  });
  await customer.save();
  res.status(201).json({ success: true, data: customer });
});

// ✅ AFTER: Creates customer in current shop
router.post("/", async (req, res) => {
  const customer = new Customer({
    shop: req.shopId, // ← ASSIGN TO SHOP
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
  });
  await customer.save();
  res.status(201).json({ success: true, data: customer });
});


// ============================================================================
// 6. CUSTOMER ROUTES: UPDATE
// ============================================================================

// ❌ BEFORE: Updates any customer (no ownership check)
router.put("/:id", async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body);
  res.json({ success: true, data: customer });
});

// ✅ AFTER: Updates customer ONLY if in current shop
router.put("/:id", async (req, res) => {
  const customer = await Customer.findOneAndUpdate(
    {
      _id: req.params.id,
      shop: req.shopId, // ← VERIFY OWNERSHIP
    },
    req.body,
    { new: true }
  );
  if (!customer) return res.status(404).json({ success: false });
  res.json({ success: true, data: customer });
});


// ============================================================================
// 7. CUSTOMER ROUTES: DELETE
// ============================================================================

// ❌ BEFORE: Deletes any customer (no ownership check)
router.delete("/:id", async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ✅ AFTER: Deletes customer ONLY if in current shop
router.delete("/:id", async (req, res) => {
  const deleted = await Customer.findOneAndDelete({
    _id: req.params.id,
    shop: req.shopId, // ← VERIFY OWNERSHIP
  });
  if (!deleted) return res.status(404).json({ success: false });
  res.json({ success: true });
});


// ============================================================================
// 8. SALES ROUTES: AGGREGATE (Stats)
// ============================================================================

// ❌ BEFORE: Stats from ALL shops combined
router.get("/stats/daily", async (req, res) => {
  const stats = await Sale.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$finalTotal" },
      },
    },
  ]);
  res.json({ success: true, data: stats });
});

// ✅ AFTER: Stats for current shop only
router.get("/stats/daily", async (req, res) => {
  const stats = await Sale.aggregate([
    {
      $match: { shop: req.shopId }, // ← FILTER FIRST
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$finalTotal" },
      },
    },
  ]);
  res.json({ success: true, data: stats });
});


// ============================================================================
// 9. MEDICINE ROUTES: SEARCH
// ============================================================================

// ❌ BEFORE: Searches ALL medicines
router.get("/search", async (req, res) => {
  const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const medicines = await Medicine.find({
    name: { $regex: escapeRegex(req.query.name), $options: "i" },
  });
  res.json({ success: true, data: medicines });
});

// ✅ AFTER: Searches medicines in current shop only
router.get("/search", async (req, res) => {
  const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const medicines = await Medicine.find({
    shop: req.shopId, // ← ADD SHOP FILTER
    name: { $regex: escapeRegex(req.query.name), $options: "i" },
  });
  res.json({ success: true, data: medicines });
});


// ============================================================================
// 10. FRONTEND API CALLS
// ============================================================================

// ❌ BEFORE: No auth header
async function getCustomers() {
  const response = await fetch("/api/customers", {
    method: "GET",
  });
  return response.json();
}

// ✅ AFTER: Includes auth header
async function getCustomers() {
  const token = localStorage.getItem("ptp_token");
  const response = await fetch("/api/customers", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // ← ADD HEADER
    },
  });
  return response.json();
}


// ============================================================================
// 11. PHONE UNIQUENESS HANDLING
// ============================================================================

// ❌ BEFORE: Phone globally unique (prevents multi-tenant)
const customerSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true }, // ← GLOBAL UNIQUE
});

// ✅ AFTER: Phone unique per shop (allows multi-tenant)
const customerSchema = new mongoose.Schema({
  shop: { type: ObjectId, ref: "Shop", required: true },
  name: String,
  phone: String,
});
customerSchema.index({ shop: 1, phone: 1, unique: true }); // ← COMPOUND UNIQUE


// ============================================================================
// 12. ERROR CHECKING
// ============================================================================

// ✅ VERIFY YOUR CODE CHANGES

// After changing routes, you should see patterns like:

// 1. All CREATE operations have: shop: req.shopId
//   new Customer({ shop: req.shopId, ... })
//   new Sale({ shop: req.shopId, ... })

// 2. All READ operations filter by shop:
//   find({ shop: req.shopId, ... })
//   findOne({ _id: id, shop: req.shopId })

// 3. All UPDATE operations verify shop:
//   findOneAndUpdate({ _id: id, shop: req.shopId }, ...)

// 4. All DELETE operations verify shop:
//   findOneAndDelete({ _id: id, shop: req.shopId })

// 5. Aggregation pipelines start with $match:
//   aggregate([{ $match: { shop: req.shopId } }, ...])

// 6. JWT includes shopId:
//   jwt.sign({ ..., shopId: user.shop }, secret)

// 7. Auth middleware sets req.shopId:
//   req.shopId = payload.shopId

// 8. Indexes are compound:
//   { shop: 1, phone: 1, unique: true }
//   { shop: 1, name: 1 }
//   { shop: 1, createdAt: -1 }
