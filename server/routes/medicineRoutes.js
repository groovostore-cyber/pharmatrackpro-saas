const express = require("express");
const { getMedicines, createMedicine, updateMedicine, updateStockByIncrement } = require("../controllers/medicineController");

const router = express.Router();

router.get("/", getMedicines);
router.post("/", createMedicine);
router.put("/update-stock/:id", updateStockByIncrement);
router.put("/:id/stock", updateMedicine);
router.put("/:id", updateMedicine);

module.exports = router;
