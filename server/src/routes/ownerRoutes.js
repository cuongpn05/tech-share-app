const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

// Tuyến đường lấy thống kê KPIs và doanh thu cho Owner Dashboard
router.get('/dashboard', ownerController.getOwnerDashboardStats);

// Tuyến đường lấy danh sách tin nhắn khách hàng (Customer Messages)
router.get('/messages', ownerController.getOwnerCustomerMessages);

// Tuyến đường lấy danh sách yêu cầu thuê mới chờ duyệt (Pending Approval)
router.get('/pending-bookings', ownerController.getOwnerPendingBookings);

// Tuyến đường lấy toàn bộ đơn thuê của chủ máy
router.get('/bookings', ownerController.getOwnerBookings);

// Tuyến đường duyệt hoặc từ chối yêu cầu thuê
router.patch('/bookings/:id/status', ownerController.updateBookingStatus);

module.exports = router;
