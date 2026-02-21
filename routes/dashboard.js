// This file is deprecated. All routes are now in server.js
// Keeping this empty export to avoid breaking the app.use("/api", dashboardRoutes) in server.js

const express = require("express");
const router = express.Router();

// All dashboard routes are registered directly in server.js
// This router serves as a no-op middleware to maintain backward compatibility

module.exports = router;
