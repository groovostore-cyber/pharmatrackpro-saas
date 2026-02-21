const express = require("express");
const { getCredits, updateCreditPayment } = require("../controllers/creditController");

const router = express.Router();

router.get("/", getCredits);
router.put("/:id/payment", updateCreditPayment);

module.exports = router;
