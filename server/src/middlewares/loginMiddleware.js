/**
 * ============================================================
 *  LOGIN MIDDLEWARE  –  server/src/middlewares/loginMiddleware.js
 * ============================================================
 *  Các middleware liên quan đến luồng đăng nhập:
 *
 *  1. validateLoginInput  – Kiểm tra đầu vào trước khi vào controller
 *  2. verifyLoginToken    – Xác thực JWT token sau khi đã đăng nhập
 *                          (dùng để bảo vệ route /api/login/verify)
 * ============================================================
 */

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────
//  1. Middleware validate đầu vào cho POST /api/login
// ─────────────────────────────────────────────────────────

/**
 * @middleware validateLoginInput
 * @desc      Kiểm tra body request có đủ identifier và password không
 *            trước khi đẩy sang loginController
 */
const validateLoginInput = (req, res, next) => {
  const { identifier, password } = req.body;

  if (!identifier || String(identifier).trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập tên đăng nhập hoặc email.',
      field  : 'identifier',
    });
  }

  if (!password || String(password).trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập mật khẩu.',
      field  : 'password',
    });
  }

  // Kiểm tra độ dài mật khẩu tối thiểu
  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu phải có ít nhất 6 ký tự.',
      field  : 'password',
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────
//  2. Middleware xác thực JWT token (dành riêng cho login)
// ─────────────────────────────────────────────────────────

/**
 * @middleware verifyLoginToken
 * @desc      Xác thực JWT gắn trong header Authorization.
 *            Dùng để kiểm tra user đã đăng nhập chưa (ví dụ: auto-login).
 *            Nếu token hợp lệ, gán req.decodedToken và gọi next().
 *            Nếu không hợp lệ, trả về 401.
 */
const verifyLoginToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.',
    });
  }

  const token  = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';

  try {
    const decoded       = jwt.verify(token, secret);
    req.decodedToken    = decoded;  // Gán payload vào request để controller dùng
    next();
  } catch (err) {
    // Thử lại với key cũ (backward compatibility)
    try {
      const decoded    = jwt.verify(token, 'techshare_secret_key');
      req.decodedToken = decoded;
      next();
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Token đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
  }
};

module.exports = {
  validateLoginInput,
  verifyLoginToken,
};
