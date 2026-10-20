/**
 * ============================================================
 *  FORGOT PASSWORD CONTROLLER  –  server/src/controllers/forgotController.js
 * ============================================================
 *  Xử lý toàn bộ nghiệp vụ luồng QUÊN MẬT KHẨU / ĐẶT LẠI MẬT KHẨU:
 *  1. findAccountAndSendOtp : Tìm tài khoản theo username hoặc email -> gửi OTP
 *  2. verifyOtp             : Kiểm tra mã OTP 6 chữ số -> cấp resetToken
 *  3. resetPassword         : Cập nhật mật khẩu mới và mã hóa bằng bcrypt
 *  4. resendOtp             : Gửi lại mã OTP mới nếu mã cũ hết hạn
 *
 *  Tách riêng thành file độc lập để dễ bảo trì, mở rộng và báo cáo.
 * ============================================================
 */

const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const Account      = require('../models/Account');
const User         = require('../models/User');
const ForgotOtp    = require('../models/ForgotOtp');
const emailService = require('../services/emailService');

/**
 * Hàm hỗ trợ che bớt ký tự email để hiển thị an toàn trên giao diện
 * Ví dụ: phainon33m5@gmail.com -> ph***@gmail.com
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
};

// ─────────────────────────────────────────────────────────
//  1. Tìm tài khoản & Gửi mã OTP
// ─────────────────────────────────────────────────────────

/**
 * @desc    Bước 1 – Tìm kiếm tài khoản qua username hoặc email, sinh OTP và gửi qua Gmail
 * @route   POST /api/forgot-password/send-otp
 * @access  Public
 * @body    { identifier: string } (username hoặc email)
 */
const findAccountAndSendOtp = async (req, res) => {
  try {
    const { identifier } = req.body;

    // Validate đầu vào
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your username or email address.',
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // Tìm kiếm trong collection accounts theo username HOẶC email
    const account = await Account.findOne({
      $or: [
        { username: cleanIdentifier },
        { email: cleanIdentifier },
      ],
    }).populate('user');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'No account found associated with this username or email. Please check and try again.',
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'This account is currently deactivated or suspended. Please contact support.',
      });
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Xóa các OTP quên mật khẩu cũ của email này để tránh trùng lặp
    await ForgotOtp.deleteMany({ email: account.email });

    // Tạo bản ghi OTP mới (hết hạn sau 10 phút)
    await ForgotOtp.create({
      email: account.email,
      accountId: account._id,
      otp: otpCode,
      isVerified: false,
      createdAt: new Date(),
    });

    // Lấy tên hiển thị của người dùng (từ User profile hoặc Account username)
    let displayName = account.username;
    if (account.user && account.user.name) {
      displayName = account.user.name;
    } else {
      const userProfile = await User.findOne({ accountId: account._id });
      if (userProfile && userProfile.name) {
        displayName = userProfile.name;
      }
    }

    // Gửi email chứa OTP qua Gmail SMTP sử dụng App Password từ .env
    try {
      await emailService.sendForgotPasswordOtpEmail(account.email, otpCode, displayName);
    } catch (mailError) {
      console.error('[ForgotController] Lỗi gửi email OTP:', mailError);
      return res.status(500).json({
        success: false,
        message: 'Unable to send OTP email at this time. Please try again later.',
        error: mailError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `An OTP verification code has been sent to ${maskEmail(account.email)}. Please check your inbox or spam folder.`,
      email: account.email,
      maskedEmail: maskEmail(account.email),
      expiresInSeconds: 300, // Khuyến nghị người dùng nhập trong 5 phút
    });
  } catch (error) {
    console.error('[ForgotController] Lỗi trong findAccountAndSendOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while finding account and sending OTP code.',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────
//  2. Xác thực mã OTP
// ─────────────────────────────────────────────────────────

/**
 * @desc    Bước 2 – Xác thực mã OTP người dùng nhập vào
 * @route   POST /api/forgot-password/verify-otp
 * @access  Public
 * @body    { email: string, otp: string }
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and 6-digit OTP code.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Tìm bản ghi OTP khớp với email và mã
    const otpDoc = await ForgotOtp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'OTP code is incorrect or has expired. Please check again or request a new code.',
      });
    }

    // Sinh token an toàn resetToken dùng 1 lần để xác thực bước đổi mật khẩu
    const resetToken = crypto.randomBytes(32).toString('hex');
    otpDoc.isVerified = true;
    otpDoc.resetToken = resetToken;
    await otpDoc.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You may now create a new password.',
      email: cleanEmail,
      resetToken,
    });
  } catch (error) {
    console.error('[ForgotController] Lỗi trong verifyOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'System error occurred during OTP verification.',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────
//  3. Đặt lại mật khẩu mới
// ─────────────────────────────────────────────────────────

/**
 * @desc    Bước 3 – Đặt lại mật khẩu mới sau khi xác thực OTP thành công
 * @route   POST /api/forgot-password/reset-password
 * @access  Public
 * @body    { email: string, resetToken: string, newPassword: string, confirmPassword?: string }
 */
const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: email, verification token, and new password.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Kiểm tra độ dài mật khẩu mới
    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    // Kiểm tra khớp mật khẩu xác nhận nếu có gửi lên
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password does not match new password.',
      });
    }

    // Kiểm tra phiên xác thực OTP hợp lệ
    const otpDoc = await ForgotOtp.findOne({
      email: cleanEmail,
      resetToken,
      isVerified: true,
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Password reset session is invalid or has expired. Please start over from step 1.',
      });
    }

    // Băm mật khẩu mới bằng bcrypt với salt rounds = 10
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu trong database
    const updatedAccount = await Account.findByIdAndUpdate(
      otpDoc.accountId,
      { passwordHash },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account to update was not found.',
      });
    }

    // Xóa các bản ghi OTP của email này để không thể tái sử dụng token
    await ForgotOtp.deleteMany({ email: cleanEmail });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    console.error('[ForgotController] Lỗi trong resetPassword:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while resetting password.',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────
//  4. Gửi lại mã OTP
// ─────────────────────────────────────────────────────────

/**
 * @desc    Gửi lại mã OTP mới khi mã cũ hết hạn
 * @route   POST /api/forgot-password/resend-otp
 * @access  Public
 * @body    { email: string }
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the email address to resend OTP.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Kiểm tra tài khoản tồn tại
    const account = await Account.findOne({ email: cleanEmail }).populate('user');
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    // Sinh mã OTP 6 số mới
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Xóa OTP cũ và lưu OTP mới
    await ForgotOtp.deleteMany({ email: cleanEmail });
    await ForgotOtp.create({
      email: cleanEmail,
      accountId: account._id,
      otp: newOtpCode,
      isVerified: false,
      createdAt: new Date(),
    });

    const displayName = account.user?.name || account.username;

    // Gửi email
    await emailService.sendForgotPasswordOtpEmail(cleanEmail, newOtpCode, displayName);

    return res.status(200).json({
      success: true,
      message: `A new OTP code has been resent to ${maskEmail(cleanEmail)}.`,
      email: cleanEmail,
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('[ForgotController] Lỗi trong resendOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to resend OTP code at this time. Please try again later.',
      error: error.message,
    });
  }
};

module.exports = {
  findAccountAndSendOtp,
  verifyOtp,
  resetPassword,
  resendOtp,
};
