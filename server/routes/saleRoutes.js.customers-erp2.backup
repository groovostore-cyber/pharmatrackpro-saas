const express = require("express");
const { createSale, getSales, getSaleById } = require("../controllers/saleController");

const router = express.Router();

router.post("/", createSale);
router.get("/", getSales);
router.get("/:id", getSaleById);

module.exports = router;
