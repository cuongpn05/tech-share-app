const express = require('express');
const { getDashboardStats } = require('../controllers/adminController');

const router = express.Router();

// Endpoint lấy số liệu Dashboard & Analytics từ MongoDB
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getDashboardStats);

module.exports = router;
