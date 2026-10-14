const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Account = require('../models/Account');
const User = require('../models/User');
const Role = require('../models/Role');
const EkycRequest = require('../models/EkycRequest');

/**
 * Controller đăng nhập người dùng từ collection accounts
 * Phân role: renter, owner, admin
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.',
      });
    }

    const trimmedIdentifier = String(identifier).trim().toLowerCase();

    // 1. Tìm bản ghi trong collection accounts theo username hoặc email
    const account = await Account.findOne({
      $or: [{ username: trimmedIdentifier }, { email: trimmedIdentifier }],
    })
      .select('+passwordHash')
      .populate('roleId');

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // 2. Xác thực mật khẩu bằng bcrypt
    const isPasswordMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // 3. Kiểm tra tài khoản bị vô hiệu hóa
    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động. Vui lòng liên hệ hỗ trợ.',
      });
    }

    // 4. Phân role (admin, owner, renter) từ collection roles
    let roleCode = 'renter';
    if (account.roleId && typeof account.roleId === 'object' && account.roleId.code) {
      roleCode = account.roleId.code;
    } else if (account.roleId) {
      const foundRole = await Role.findById(account.roleId);
      if (foundRole && foundRole.code) {
        roleCode = foundRole.code;
      }
    }

    const validRoles = ['renter', 'owner', 'admin'];
    if (!validRoles.includes(roleCode)) {
      roleCode = 'renter';
    }

    // 5. Tìm hoặc đồng bộ hồ sơ User
    let user = await User.findOne({ accountId: account._id });
    if (!user && account.email) {
      user = await User.findOne({ email: account.email });
      if (user && !user.accountId) {
        user.accountId = account._id;
        await User.updateOne({ _id: user._id }, { $set: { accountId: account._id } });
      }
    }

    // Khởi tạo hồ sơ User nếu chưa có
    if (!user) {
      user = await User.create({
        accountId: account._id,
        username: account.username,
        email: account.email,
        name: account.username,
        role: roleCode,
        isVerified: roleCode === 'admin',
      });
    } else {
      if (user.role !== roleCode) {
        user.role = roleCode;
        await User.updateOne({ _id: user._id }, { $set: { role: roleCode } });
      }
    }

    // 6. Kiểm tra trạng thái eKYC
    if (roleCode === 'admin') {
      if (!user.isVerified) {
        user.isVerified = true;
        await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
      }
    } else {
      const approvedEkyc = await EkycRequest.findOne({
        userId: user._id,
        status: 'approved',
      });
      if (approvedEkyc && !user.isVerified) {
        user.isVerified = true;
        await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
      }
    }

    // 7. Cập nhật lastLogin
    await Account.updateOne({ _id: account._id }, { $set: { lastLogin: new Date() } });

    // 8. Tạo JWT token thời hạn 7 ngày
    const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    const payload = {
      id: user._id,
      accountId: account._id,
      email: account.email,
      username: account.username,
      role: roleCode,
      name: user.name,
    };

    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    // 9. Trả về kết quả đăng nhập thành công
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        _id: user._id,
        accountId: account._id,
        username: account.username,
        email: account.email,
        name: user.name,
        role: roleCode,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        isVerified: user.isVerified,
        trustScore: user.trustScore,
        walletBalance: user.walletBalance,
        walletEscrowBalance: user.walletEscrowBalance,
      },
    });
  } catch (error) {
    console.error('Error in login controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình xử lý đăng nhập.',
      error: error.message,
    });
  }
};

/**
 * Lấy thông tin user hiện tại từ token
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
      account: {
        _id: req.account._id,
        username: req.account.username,
        email: req.account.email,
        role: req.userRole,
        lastLogin: req.account.lastLogin,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải thông tin tài khoản.',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  getMe,
};
