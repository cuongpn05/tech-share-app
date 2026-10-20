const express = require("express");
const {
  compareDevices,
  consultDevice,
  generateDeviceDescription,
} = require("../controllers/aiController");

const router = express.Router();
router.post("/compare", compareDevices);
router.post("/consultant", consultDevice);
router.post("/generate-description", generateDeviceDescription);

module.exports = router;