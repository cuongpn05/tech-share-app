/**
 * ============================================================
 *  REGISTER CONTROLLER  –  server/src/controllers/registerController.js
 * ============================================================
 *  Chịu trách nhiệm duy nhất: xử lý luồng ĐĂNG KÝ tài khoản mới
 *  theo quy trình 2 bước: Điền thông tin → Xác thực OTP qua Email
 *
 *  Gồm 3 controller con:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ 1. sendRegisterOtp   – Bước 1: Nhận thông tin, gửi OTP  │
 *  │ 2. verifyRegisterOtp – Bước 2: Xác thực OTP, tạo tài    │
 *  │                        khoản chính thức                  │
 *  │ 3. resendRegisterOtp – Gửi lại OTP khi hết hạn          │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Sơ đồ luồng đăng ký:
 *   Client gửi thông tin
 *       ↓
 *   sendRegisterOtp  →  Validate → Kiểm tra trùng lặp → Hash PW → Lưu OTP → Gửi Email
 *       ↓
 *   verifyRegisterOtp → Xác thực OTP → Tạo Account + User → Phát JWT → Response
 * ============================================================
 */

const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');

const Account      = require('../models/Account');
const User         = require('../models/User');
const Role         = require('../models/Role');
const Otp          = require('../models/Otp');
const emailService = require('../services/emailService');

// ─────────────────────────────────────────────────────────
//  Controller 1: POST /api/register/send-otp
// ─────────────────────────────────────────────────────────

/**
 * @desc    Bước 1 – Nhận thông tin đăng ký, validate, lưu OTP và gửi email
 * @route   POST /api/register/send-otp
 * @access  Public
 * @body    { username, name, email, phone, password }
 * @returns { success, message, email, expiresInSeconds }
 */
const sendRegisterOtp = async (req, res) => {
  try {
    const { username, name, email, phone, password } = req.body;

    // ── Bước 1: Kiểm tra các trường bắt buộc ─────────────
    if (!username || !name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin: Tên đăng nhập, Họ và tên, Email, Số điện thoại và Mật khẩu.',
      });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const trimmedEmail    = String(email).trim().toLowerCase();
    const trimmedName     = String(name).trim();
    const trimmedPhone    = String(phone).trim();

    // ── Bước 2: Validate định dạng username ──────────────
    // Tối thiểu 3 ký tự, chỉ chứa chữ cái, số hoặc dấu gạch dưới
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập từ 3–30 ký tự và chỉ chứa chữ cái, số hoặc dấu gạch dưới (_).',
      });
    }

    // ── Bước 3: Validate định dạng email ─────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ email không đúng định dạng.',
      });
    }

    // ── Bước 4: Validate số điện thoại (9–15 chữ số) ─────
    const phoneRegex = /^[0-9+]{9,15}$/;
    if (!phoneRegex.test(trimmedPhone.replace(/[\s.-]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại không hợp lệ. Vui lòng nhập từ 9–15 chữ số.',
      });
    }

    // ── Bước 5: Validate độ dài mật khẩu (tối thiểu 6 ký tự) ─
    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
      });
    }

    // ── Bước 6: Kiểm tra username đã tồn tại chưa ────────
    const existingByUsername = await Account.findOne({ username: trimmedUsername });
    if (existingByUsername) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.',
      });
    }

    // ── Bước 7: Kiểm tra email đã tồn tại chưa ──────────
    const existingByEmail = await Account.findOne({ email: trimmedEmail });
    if (existingByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc dùng email khác.',
      });
    }

    // ── Bước 8: Kiểm tra số điện thoại đã tồn tại chưa ──
    const existingByPhone = await User.findOne({ phone: trimmedPhone });
    if (existingByPhone) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại này đã được sử dụng cho một tài khoản khác.',
      });
    }

    // ── Bước 9: Hash mật khẩu bằng bcrypt ────────────────
    // Lưu tạm passwordHash vào document OTP để dùng ở bước verify
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Bước 10: Sinh mã OTP 6 chữ số ngẫu nhiên ─────────
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ── Bước 11: Xoá OTP cũ và lưu OTP mới kèm dữ liệu đăng ký ─
    await Otp.deleteMany({ email: trimmedEmail });
    await Otp.create({
      email           : trimmedEmail,
      otp             : otpCode,
      registrationData: {
        username    : trimmedUsername,
        name        : trimmedName,
        phone       : trimmedPhone,
        passwordHash,
      },
      createdAt: new Date(),
    });

    // ── Bước 12: Gửi email chứa mã OTP qua Gmail SMTP ────
    try {
      await emailService.sendRegistrationOtpEmail(trimmedEmail, otpCode, trimmedName);
    } catch (mailError) {
      console.error('[RegisterController] Lỗi gửi email OTP:', mailError);
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại sau.',
        error  : mailError.message,
      });
    }

    // ── Bước 13: Trả về thành công ───────────────────────
    return res.status(200).json({
      success         : true,
      message         : 'Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.',
      email           : trimmedEmail,
      expiresInSeconds: 300,  // OTP hết hạn sau 5 phút
    });
  } catch (error) {
    console.error('[RegisterController] Lỗi trong sendRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi xử lý gửi mã OTP.',
      error  : error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────
//  Controller 2: POST /api/register/verify-otp
// ─────────────────────────────────────────────────────────

/**
 * @desc    Bước 2 – Xác thực mã OTP, tạo Account + User, trả về JWT token
 * @route   POST /api/register/verify-otp
 * @access  Public
 * @body    { email, otp }
 * @returns { success, message, token, user }
 */
const verifyRegisterOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // ── Bước 1: Validate đầu vào ──────────────────────────
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ email và mã OTP 6 số.',
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedOtp   = String(otp).trim();

    // ── Bước 2: Tìm document OTP khớp với email và mã ────
    const otpDoc = await Otp.findOne({
      email: trimmedEmail,
      otp  : trimmedOtp,
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác hoặc đã hết hạn (quá 5 phút). Vui lòng thử lại.',
      });
    }

    const { registrationData } = otpDoc;

    // ── Bước 3: Kiểm tra trùng lặp lần cuối ──────────────
    // Phòng trường hợp race condition (2 phiên submit cùng lúc)
    const duplicateAccount = await Account.findOne({
      $or: [
        { username: registrationData.username },
        { email   : trimmedEmail },
      ],
    });
    if (duplicateAccount) {
      await Otp.deleteMany({ email: trimmedEmail });
      return res.status(400).json({
        success: false,
        message: 'Tài khoản hoặc email này vừa được tạo bởi phiên khác. Vui lòng đăng nhập.',
      });
    }

    // ── Bước 4: Tìm hoặc tạo role 'renter' ───────────────
    // Mặc định tất cả tài khoản mới đăng ký đều là renter
    let renterRole = await Role.findOne({ code: 'renter' });
    if (!renterRole) {
      renterRole = await Role.create({
        code       : 'renter',
        name       : 'Người thuê',
        description: 'Tài khoản người thuê thiết bị',
        permissions: ['rent_device', 'review_device', 'chat'],
      });
    }

    // ── Bước 5: Tạo Account trong collection 'accounts' ──
    const newAccount = await Account.create({
      username    : registrationData.username,
      email       : trimmedEmail,
      passwordHash: registrationData.passwordHash,
      roleId      : renterRole._id,
      isActive    : true,
      lastLogin   : new Date(),
    });

    // ── Bước 6: Sinh mã giới thiệu (referral code) ───────
    // Định dạng: TS + 6 ký tự đầu username (viết hoa) + 4 số ngẫu nhiên
    const cleanPrefix  = registrationData.username
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `TS${cleanPrefix}${randomSuffix}`;

    // ── Bước 7: Tạo User profile trong collection 'users' ─
    // Dữ liệu mặc định ban đầu, user sẽ tự cập nhật trong phần Profile
    const newUser = await User.create({
      accountId : newAccount._id,
      username  : newAccount.username,
      name      : registrationData.name,
      phone     : registrationData.phone,
      address   : null,
      avatar    : null,
      trust: {
        isVerified: false,  // Chưa xác thực eKYC
        score     : 100,    // Điểm tin cậy ban đầu
        badges    : [],
      },
      wallet: {
        balance      : 0,
        escrowBalance: 0,
      },
      pushConfig: {
        expoPushToken  : '',
        fcmTokens      : [],
        biometricEnabled: false,
      },
      location: {
        type       : 'Point',
        coordinates: [105.7826, 21.0285],  // Mặc định Hà Nội, Việt Nam
      },
      wishlist    : [],
      referralCode,
      referredBy  : null,
      rating      : 5.0,
      totalReviews: 0,
      isActive    : true,
    });

    // ── Bước 8: Xoá document OTP đã sử dụng ──────────────
    await Otp.deleteMany({ email: trimmedEmail });

    // ── Bước 9: Tạo JWT token thời hạn 7 ngày ────────────
    const secret  = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    const payload = {
      id       : newUser._id,
      accountId: newAccount._id,
      email    : newAccount.email,
      username : newAccount.username,
      role     : 'renter',
      name     : newUser.name,
    };
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    // ── Bước 10: Trả về kết quả đăng ký thành công ───────
    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        _id               : newUser._id,
        accountId         : newAccount._id,
        username          : newAccount.username,
        email             : newAccount.email,
        name              : newUser.name,
        role              : 'renter',
        avatar            : newUser.avatar,
        phone             : newUser.phone,
        address           : newUser.address,
        isVerified        : newUser.isVerified,
        trustScore        : newUser.trustScore,
        walletBalance     : newUser.walletBalance,
        walletEscrowBalance: newUser.walletEscrowBalance,
      },
    });
  } catch (error) {
    console.error('[RegisterController] Lỗi trong verifyRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình xác thực và tạo tài khoản.',
      error  : error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────
//  Controller 3: POST /api/register/resend-otp
// ─────────────────────────────────────────────────────────

/**
 * @desc    Gửi lại mã OTP mới cho email đang trong quá trình đăng ký
 * @route   POST /api/register/resend-otp
 * @access  Public
 * @body    { email }
 * @returns { success, message, email, expiresInSeconds }
 */
const resendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // ── Bước 1: Validate đầu vào ──────────────────────────
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email cần gửi lại mã OTP.',
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // ── Bước 2: Tìm phiên đăng ký đang chờ xác thực ──────
    const existingOtpDoc = await Otp.findOne({ email: trimmedEmail });
    if (!existingOtpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Phiên đăng ký đã hết hạn hoặc không tồn tại. Vui lòng nhập lại thông tin đăng ký.',
      });
    }

    // ── Bước 3: Sinh mã OTP mới và cập nhật document ─────
    const newOtpCode         = Math.floor(100000 + Math.random() * 900000).toString();
    existingOtpDoc.otp       = newOtpCode;
    existingOtpDoc.createdAt = new Date();
    await existingOtpDoc.save();

    // ── Bước 4: Gửi email với mã OTP mới ─────────────────
    await emailService.sendRegistrationOtpEmail(
      trimmedEmail,
      newOtpCode,
      existingOtpDoc.registrationData?.name || '',
    );

    // ── Bước 5: Trả về thành công ─────────────────────────
    return res.status(200).json({
      success         : true,
      message         : 'Mã xác thực mới đã được gửi đến email của bạn.',
      email           : trimmedEmail,
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('[RegisterController] Lỗi trong resendRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi gửi lại mã OTP. Vui lòng thử lại sau.',
      error  : error.message,
    });
  }
};

module.exports = {
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
};
