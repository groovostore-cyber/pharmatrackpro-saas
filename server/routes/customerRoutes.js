const express = require("express");
const { getCustomers, createCustomer, getCreditCustomers, getCustomerSales } = require("../controllers/customerController");

const router = express.Router();

router.get("/", getCustomers);
router.post("/", createCustomer);
router.get("/credit", getCreditCustomers);
router.get("/:id/sales", getCustomerSales);

module.exports = router;
