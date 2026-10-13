const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

// Tuyến đường lấy thống kê KPIs và doanh thu cho Owner Dashboard
router.get('/dashboard', ownerController.getOwnerDashboardStats);

module.exports = router;
