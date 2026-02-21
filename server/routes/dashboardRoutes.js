const express = require("express");
const { getCards, getMonthlyRevenue, getTopMedicines, getStats } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/cards", getCards);
router.get("/monthly-revenue", getMonthlyRevenue);
router.get("/top-medicines", getTopMedicines);
router.get("/stats", getStats);

module.exports = router;
