const express = require('express');
const {
  getDashboardStats,
  getModerationDevices,
  approveDevice,
  rejectDevice,
} = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/adminMiddleware');

const router = express.Router();

// Endpoint lấy số liệu Dashboard & Analytics từ MongoDB
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getDashboardStats);

// Endpoint lấy danh sách thiết bị kiểm duyệt - Backlog #51
router.get('/devices/moderation', requireAuth, adminMiddleware, getModerationDevices);

// Endpoint phê duyệt & từ chối kiểm duyệt thiết bị
router.patch('/devices/:id/approve', requireAuth, adminMiddleware, approveDevice);
router.patch('/devices/:id/reject', requireAuth, adminMiddleware, rejectDevice);

module.exports = router;
