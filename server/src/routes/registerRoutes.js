/**
 * ============================================================
 *  REGISTER ROUTES  –  server/src/routes/registerRoutes.js
 * ============================================================
 *  Định nghĩa 3 endpoints cho luồng đăng ký tài khoản 2 bước:
 *
 *  Bước 1 – Gửi OTP:
 *    POST /api/register/send-otp   →  registerController.sendRegisterOtp
 *
 *  Bước 2 – Xác thực OTP & Tạo tài khoản:
 *    POST /api/register/verify-otp →  registerController.verifyRegisterOtp
 *
 *  Phụ – Gửi lại OTP khi hết hạn:
 *    POST /api/register/resend-otp →  registerController.resendRegisterOtp
 *
 *  Tất cả đều là Public route – không yêu cầu JWT token.
 * ============================================================
 */

const express = require('express');
const router  = express.Router();

const {
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
} = require('../controllers/registerController');

const {
  validateSendOtpInput,
  validateVerifyOtpInput,
} = require('../middlewares/registerMiddleware');

// ─────────────────────────────────────────────────────────
//  Bước 1: Gửi OTP đăng ký
// ─────────────────────────────────────────────────────────

/**
 * @route   POST /api/register/send-otp
 * @desc    Nhận thông tin đăng ký, validate, gửi mã OTP qua email
 * @access  Public
 * @body    { username, name, email, phone, password }
 */
router.post('/send-otp', validateSendOtpInput, sendRegisterOtp);

// ─────────────────────────────────────────────────────────
//  Bước 2: Xác thực OTP & Tạo tài khoản chính thức
// ─────────────────────────────────────────────────────────

/**
 * @route   POST /api/register/verify-otp
 * @desc    Xác thực mã OTP, tạo Account + User, trả về JWT token
 * @access  Public
 * @body    { email, otp }
 */
router.post('/verify-otp', validateVerifyOtpInput, verifyRegisterOtp);

// ─────────────────────────────────────────────────────────
//  Phụ: Gửi lại OTP khi hết hạn
// ─────────────────────────────────────────────────────────

/**
 * @route   POST /api/register/resend-otp
 * @desc    Sinh OTP mới và gửi lại email cho phiên đăng ký đang chờ
 * @access  Public
 * @body    { email }
 */
router.post('/resend-otp', resendRegisterOtp);

module.exports = router;
