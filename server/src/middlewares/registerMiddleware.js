/**
 * ============================================================
 *  REGISTER MIDDLEWARE  –  server/src/middlewares/registerMiddleware.js
 * ============================================================
 *  Các middleware validate đầu vào cho từng bước đăng ký,
 *  chạy TRƯỚC khi request đến registerController.
 *
 *  1. validateSendOtpInput   – Kiểm tra body của POST /api/register/send-otp
 *  2. validateVerifyOtpInput – Kiểm tra body của POST /api/register/verify-otp
 *
 *  Tác dụng: Tách logic validation khỏi controller,
 *  giúp controller chỉ tập trung vào business logic chính.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
//  Regex dùng chung
// ─────────────────────────────────────────────────────────

const REGEX = {
  username: /^[a-zA-Z0-9_]{3,30}$/,
  email   : /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone   : /^[0-9+]{9,15}$/,
};

// ─────────────────────────────────────────────────────────
//  1. Middleware cho Bước 1: POST /api/register/send-otp
// ─────────────────────────────────────────────────────────

/**
 * @middleware validateSendOtpInput
 * @desc      Kiểm tra tất cả trường bắt buộc trong body của send-otp
 *            trước khi đẩy sang sendRegisterOtp controller.
 *
 *            Kiểm tra:
 *            - username: bắt buộc, 3–30 ký tự, chỉ [a-zA-Z0-9_]
 *            - name    : bắt buộc, không được để trống
 *            - email   : bắt buộc, đúng định dạng email
 *            - phone   : bắt buộc, 9–15 chữ số
 *            - password: bắt buộc, tối thiểu 6 ký tự
 */
const validateSendOtpInput = (req, res, next) => {
  const { username, name, email, phone, password } = req.body;

  // Kiểm tra các trường bắt buộc không được rỗng
  if (!username || !name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please fill in all required fields: Username, Full Name, Email, Phone Number, and Password.',
      missingFields: {
        username: !username,
        name    : !name,
        email   : !email,
        phone   : !phone,
        password: !password,
      },
    });
  }

  const trimmedUsername = String(username).trim();
  const trimmedEmail    = String(email).trim();
  const trimmedPhone    = String(phone).trim();

  // Kiểm tra định dạng username
  if (!REGEX.username.test(trimmedUsername.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3–30 characters, containing only letters, numbers, or underscores (_).',
      field  : 'username',
    });
  }

  // Kiểm tra định dạng email
  if (!REGEX.email.test(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Email address is invalid. Example: name@example.com',
      field  : 'email',
    });
  }

  // Kiểm tra số điện thoại
  if (!REGEX.phone.test(trimmedPhone.replace(/[\s.-]/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is invalid. Please enter 9–15 digits.',
      field  : 'phone',
    });
  }

  // Kiểm tra độ dài mật khẩu
  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.',
      field  : 'password',
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────
//  2. Middleware cho Bước 2: POST /api/register/verify-otp
// ─────────────────────────────────────────────────────────

/**
 * @middleware validateVerifyOtpInput
 * @desc      Kiểm tra email và otp trong body của verify-otp
 *            trước khi đẩy sang verifyRegisterOtp controller.
 *
 *            Kiểm tra:
 *            - email: bắt buộc, đúng định dạng
 *            - otp  : bắt buộc, đúng 6 chữ số
 */
const validateVerifyOtpInput = (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and OTP code.',
    });
  }

  const trimmedEmail = String(email).trim();
  const trimmedOtp   = String(otp).trim();

  // Kiểm tra định dạng email
  if (!REGEX.email.test(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address format.',
      field  : 'email',
    });
  }

  // Kiểm tra OTP phải đúng 6 chữ số
  if (!/^\d{6}$/.test(trimmedOtp)) {
    return res.status(400).json({
      success: false,
      message: 'OTP code must be 6 digits. Please check and try again.',
      field  : 'otp',
    });
  }

  next();
};

module.exports = {
  validateSendOtpInput,
  validateVerifyOtpInput,
};
