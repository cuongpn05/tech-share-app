/**
 * ============================================================
 *  FORGOT PASSWORD ROUTES  –  server/src/routes/forgotRoutes.js
 * ============================================================
 *  Định nghĩa các endpoints phục vụ luồng quên / khôi phục mật khẩu:
 *
 *  1. POST /api/forgot-password/send-otp
 *     -> Tìm tài khoản bằng username hoặc email & gửi OTP về email
 *
 *  2. POST /api/forgot-password/verify-otp
 *     -> Xác thực mã OTP 6 số người dùng nhập
 *
 *  3. POST /api/forgot-password/reset-password
 *     -> Đặt mật khẩu mới với token bảo mật
 *
 *  4. POST /api/forgot-password/resend-otp
 *     -> Gửi lại mã OTP khi mã cũ hết hạn
 *
 *  Tất cả các route này đều là Public (không yêu cầu JWT đăng nhập).
 * ============================================================
 */

const express = require('express');
const router  = express.Router();

const {
  findAccountAndSendOtp,
  verifyOtp,
  resetPassword,
  resendOtp,
} = require('../controllers/forgotController');

/**
 * @route   POST /api/forgot-password/send-otp
 * @desc    Tìm tài khoản qua username hoặc email, gửi mã OTP qua Gmail
 * @access  Public
 * @body    { identifier: string }
 */
router.post('/send-otp', findAccountAndSendOtp);

/**
 * @route   POST /api/forgot-password/verify-otp
 * @desc    Xác thực mã OTP 6 số
 * @access  Public
 * @body    { email: string, otp: string }
 */
router.post('/verify-otp', verifyOtp);

/**
 * @route   POST /api/forgot-password/reset-password
 * @desc    Đặt lại mật khẩu mới
 * @access  Public
 * @body    { email: string, resetToken: string, newPassword: string, confirmPassword?: string }
 */
router.post('/reset-password', resetPassword);

/**
 * @route   POST /api/forgot-password/resend-otp
 * @desc    Gửi lại mã OTP
 * @access  Public
 * @body    { email: string }
 */
router.post('/resend-otp', resendOtp);

module.exports = router;
