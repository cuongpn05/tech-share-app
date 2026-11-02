/**
 * ============================================================
 *  LOGOUT ROUTES  –  server/src/routes/logoutRoutes.js
 * ============================================================
 *  Định nghĩa endpoint cho luồng đăng xuất:
 *    POST /api/logout  →  logoutController.logout
 *
 *  Route này hỗ trợ cả phiên có token hợp lệ lẫn token đã hết hạn/thiếu
 *  để đảm bảo client luôn hoàn tất đăng xuất một cách an toàn và mượt mà.
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const logoutController = require('../controllers/logoutController');
const { requireAuth } = require('../middlewares/authMiddleware');

/**
 * Soft auth middleware: Nếu có header Authorization thì giải mã user,
 * nhưng nếu token lỗi hoặc hết hạn thì vẫn tiếp tục cho qua để logout thành công.
 */
const softAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return requireAuth(req, res, (err) => {
      // Bỏ qua lỗi xác thực token khi đăng xuất
      next();
    });
  }
  next();
};

/**
 * @route   POST /api/logout
 * @desc    Đăng xuất tài khoản người dùng
 * @access  Public / Soft Authenticated
 */
router.post('/', softAuth, logoutController.logout);

module.exports = router;

