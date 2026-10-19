/**
 * ============================================================
 *  LOGIN CONTROLLER  –  server/src/controllers/loginController.js
 * ============================================================
 *  Chịu trách nhiệm duy nhất: xử lý đăng nhập người dùng
 *
 *  Luồng xử lý:
 *   Bước 1 – Validate đầu vào (identifier + password)
 *   Bước 2 – Tìm Account theo username hoặc email
 *   Bước 3 – Xác thực mật khẩu bằng bcrypt
 *   Bước 4 – Kiểm tra tài khoản có bị khóa không
 *   Bước 5 – Xác định role (renter / owner / admin)
 *   Bước 6 – Tìm / đồng bộ hồ sơ User tương ứng
 *   Bước 7 – Đồng bộ trạng thái xác thực eKYC
 *   Bước 8 – Cập nhật lastLogin
 *   Bước 9 – Ký JWT token (thời hạn 7 ngày)
 *   Bước 10 – Trả về response thành công
 * ============================================================
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const Account     = require('../models/Account');
const User        = require('../models/User');
const Role        = require('../models/Role');
const EkycRequest = require('../models/EkycRequest');

// ─────────────────────────────────────────────────────────
//  Hàm tiện ích nội bộ (private helpers)
// ─────────────────────────────────────────────────────────

/**
 * Giải quyết role code từ account.roleId đã populate hoặc tra cứu DB
 * @param {Object} account  - Mongoose document Account (đã populate roleId)
 * @returns {Promise<string>}  'renter' | 'owner' | 'admin'
 */
async function resolveRoleCode(account) {
  const VALID_ROLES  = ['renter', 'owner', 'admin'];
  const DEFAULT_ROLE = 'renter';

  // Trường hợp roleId đã được populate thành object có trường .code
  if (account.roleId && typeof account.roleId === 'object' && account.roleId.code) {
    const code = account.roleId.code;
    return VALID_ROLES.includes(code) ? code : DEFAULT_ROLE;
  }

  // Trường hợp roleId là ObjectId thuần → cần tra cứu thêm
  if (account.roleId) {
    const foundRole = await Role.findById(account.roleId);
    if (foundRole && VALID_ROLES.includes(foundRole.code)) {
      return foundRole.code;
    }
  }

  return DEFAULT_ROLE;
}

/**
 * Đồng bộ hồ sơ User với Account.
 * Nếu User chưa tồn tại sẽ tự động tạo mới với thông tin cơ bản.
 * @param {Object} account   - Mongoose document Account
 * @param {string} roleCode  - Role đã xác định từ resolveRoleCode()
 * @returns {Promise<Object>} user document
 */
async function syncUserProfile(account, roleCode) {
  // Ưu tiên tìm theo accountId
  let user = await User.findOne({ accountId: account._id });

  // Fallback: tìm theo email rồi gắn accountId nếu thiếu
  if (!user && account.email) {
    user = await User.findOne({ email: account.email });
    if (user && !user.accountId) {
      await User.updateOne({ _id: user._id }, { $set: { accountId: account._id } });
    }
  }

  // Không tìm thấy → tạo mới hồ sơ User
  if (!user) {
    user = await User.create({
      accountId : account._id,
      username  : account.username,
      email     : account.email,
      name      : account.username,
      role      : roleCode,
      isVerified: roleCode === 'admin', // Admin được xác thực tự động
    });
    return user;
  }

  // Đồng bộ role nếu bị lệch so với Account
  if (user.role !== roleCode) {
    await User.updateOne({ _id: user._id }, { $set: { role: roleCode } });
    user.role = roleCode;
  }

  return user;
}

/**
 * Kiểm tra & đồng bộ trạng thái eKYC của user
 * @param {Object} user      - Mongoose document User
 * @param {string} roleCode  - Role code đã xác định
 */
async function syncEkycStatus(user, roleCode) {
  // Admin luôn được xác thực tự động
  if (roleCode === 'admin') {
    if (!user.isVerified) {
      await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
      user.isVerified = true;
    }
    return;
  }

  // Với renter / owner: kiểm tra có bản ghi eKYC được duyệt không
  const approvedEkyc = await EkycRequest.findOne({
    userId: user._id,
    status: 'approved',
  });

  if (approvedEkyc && !user.isVerified) {
    await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
    user.isVerified = true;
  }
}

// ─────────────────────────────────────────────────────────
//  Controller chính
// ─────────────────────────────────────────────────────────

/**
 * @desc    Đăng nhập người dùng, trả về JWT token + thông tin user
 * @route   POST /api/login
 * @access  Public (không cần token)
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // ── Bước 1: Validate đầu vào ──────────────────────────
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.',
      });
    }

    const trimmedIdentifier = String(identifier).trim().toLowerCase();

    // ── Bước 2: Tìm Account theo username HOẶC email ──────
    const account = await Account.findOne({
      $or: [
        { username: trimmedIdentifier },
        { email   : trimmedIdentifier },
      ],
    })
      .select('+passwordHash') // passwordHash bị ẩn theo mặc định trong model
      .populate('roleId');     // Populate để đọc role.code ngay

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // ── Bước 3: Xác thực mật khẩu bằng bcrypt ────────────
    const isPasswordMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // ── Bước 4: Kiểm tra tài khoản bị vô hiệu hóa ────────
    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động. Vui lòng liên hệ hỗ trợ.',
      });
    }

    // ── Bước 5: Xác định role ─────────────────────────────
    const roleCode = await resolveRoleCode(account);

    // ── Bước 6: Đồng bộ hồ sơ User ───────────────────────
    const user = await syncUserProfile(account, roleCode);

    // ── Bước 7: Đồng bộ trạng thái eKYC ──────────────────
    await syncEkycStatus(user, roleCode);

    // ── Bước 8: Cập nhật thời gian đăng nhập cuối ────────
    await Account.updateOne({ _id: account._id }, { $set: { lastLogin: new Date() } });

    // ── Bước 9: Tạo JWT token có thời hạn 7 ngày ─────────
    const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    const payload = {
      id       : user._id,
      accountId: account._id,
      email    : account.email,
      username : account.username,
      role     : roleCode,
      name     : user.name,
    };
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    // ── Bước 10: Trả về kết quả đăng nhập thành công ──────
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        _id               : user._id,
        accountId         : account._id,
        username          : account.username,
        email             : account.email,
        name              : user.name,
        role              : roleCode,
        avatar            : user.avatar,
        phone             : user.phone,
        address           : user.address,
        isVerified        : user.isVerified,
        trustScore        : user.trustScore,
        walletBalance     : user.walletBalance,
        walletEscrowBalance: user.walletEscrowBalance,
      },
    });
  } catch (error) {
    console.error('[LoginController] Lỗi trong quá trình đăng nhập:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình xử lý đăng nhập.',
      error  : error.message,
    });
  }
};

module.exports = { login };
