/**
 * ============================================================
 *  FORGOT OTP MODEL  –  server/src/models/ForgotOtp.js
 * ============================================================
 *  Lưu trữ thông tin mã OTP phục vụ quy trình quên / đặt lại mật khẩu.
 *  - Tự động xóa (TTL index) sau 10 phút.
 *  - Lưu liên kết tới Account để bảo đảm tính toàn vẹn.
 *  - Lưu resetToken sinh ra sau khi OTP được xác thực thành công.
 * ============================================================
 */

const mongoose = require('mongoose');

const forgotOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  resetToken: {
    type: String,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Tự động xóa sau 10 phút (600s)
  },
});

module.exports = mongoose.models.ForgotOtp || mongoose.model('ForgotOtp', forgotOtpSchema, 'forgot_otps');
