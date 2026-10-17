const express = require("express");
const { compareDevices } = require("../controllers/aiController");

const router = express.Router();
router.post("/compare", compareDevices);

module.exports = router;