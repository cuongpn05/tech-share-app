const express = require('express');
const {
  getDashboardStats,
  getModerationDevices,
  getDeviceDetail,
  approveDevice,
  rejectDevice,
} = require('../controllers/adminController');
const { getAdminEkycSubmissions } = require('../controllers/ekycController');

const userManagementRoutes = require('./userManagementRoutes');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/adminMiddleware');

const router = express.Router();

// Endpoint lấy danh sách đơn xác thực eKYC (UC eKYC Reviews List)
router.get('/ekyc', requireAuth, adminMiddleware, getAdminEkycSubmissions);

// Endpoint lấy số liệu Dashboard & Analytics từ MongoDB
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getDashboardStats);

// Phân hệ Quản lý Người dùng (tách riêng thành userManagementRoutes)
router.use('/users', userManagementRoutes);

// Endpoint lấy danh sách thiết bị kiểm duyệt - Backlog #51
router.get('/devices/moderation', requireAuth, adminMiddleware, getModerationDevices);

// Endpoint lấy chi tiết một thiết bị kiểm duyệt - UC-A04
router.get('/devices/:id', requireAuth, adminMiddleware, getDeviceDetail);

// Endpoint phê duyệt & từ chối kiểm duyệt thiết bị
router.patch('/devices/:id/approve', requireAuth, adminMiddleware, approveDevice);
router.patch('/devices/:id/reject', requireAuth, adminMiddleware, rejectDevice);

module.exports = router;
