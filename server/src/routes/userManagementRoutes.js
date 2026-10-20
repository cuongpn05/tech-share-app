/**
 * ============================================================
 *  USER MANAGEMENT ROUTES
 *  server/src/routes/userManagementRoutes.js
 * ============================================================
 *  Mục đích:
 *   - Định tuyến riêng cho phân hệ Quản lý Người dùng (User Management).
 *   - Phân quyền: Yêu cầu đăng nhập (requireAuth) và quyền Admin (adminMiddleware).
 *   - Các endpoints:
 *       GET   /           -> Lấy danh sách thành viên (lọc role, status, tìm kiếm, phân trang)
 *       GET   /:id        -> Xem chi tiết người dùng (nâng cấp tương lai)
 *       PATCH /:id/status -> Khóa / Mở khóa tài khoản (nâng cấp tương lai)
 * ============================================================
 */

const express = require('express');
const {
  getUsersList,
  getUserDetail,
  toggleUserStatus,
} = require('../controllers/userManagementController');

const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/adminMiddleware');

const router = express.Router();

// Tất cả các routes quản lý user đều yêu cầu đăng nhập và có role admin
router.use(requireAuth, adminMiddleware);

// Lấy danh sách thành viên
router.get('/', getUsersList);

// Xem chi tiết thành viên theo ID (nâng cấp tương lai)
router.get('/:id', getUserDetail);

// Khóa hoặc mở khóa tài khoản thành viên (nâng cấp tương lai)
router.patch('/:id/status', toggleUserStatus);

module.exports = router;
