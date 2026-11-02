/**
 * ============================================================
 *  LOGOUT CONTROLLER  –  server/src/controllers/logoutController.js
 * ============================================================
 *  Chịu trách nhiệm xử lý nghiệp vụ đăng xuất (Logout Usecase):
 *   - Tiếp nhận yêu cầu POST /api/logout (hoặc POST /api/auth/logout)
 *   - Hủy/gỡ liên kết FCM Push Token khỏi tài khoản người dùng
 *   - Ghi nhật ký bảo mật khi người dùng kết thúc phiên làm việc
 *   - Trả về phản hồi thành công chuẩn hóa
 * ============================================================
 */

const User = require('../models/User');

/**
 * @desc   Đăng xuất người dùng & dọn dẹp phiên làm việc
 * @route  POST /api/logout, POST /api/auth/logout
 * @access Public / Soft Authenticated
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.body?.userId;
    const { fcmToken } = req.body || {};

    // Nếu có FCM Token và user ID, gỡ liên kết FCM Token khỏi database để dừng nhận thông báo đẩy
    if (userId && fcmToken) {
      try {
        await User.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: fcmToken },
        });
      } catch (tokenErr) {
        console.warn('[LogoutController] Cảnh báo gỡ FCM token:', tokenErr.message);
      }
    }

    if (userId) {
      console.log(`[LogoutController] ✅ Người dùng ${userId} đã đăng xuất thành công.`);
    } else {
      console.log('[LogoutController] ✅ Phiên làm việc đã được dọn dẹp thành công.');
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('[LogoutController] Lỗi xử lý đăng xuất:', err);
    // Luôn trả về 200 cho client để không làm gián đoạn luồng thoát ứng dụng
    return res.status(200).json({
      success: true,
      message: 'Client session cleared.',
    });
  }
};

