const jwt = require('jsonwebtoken');
const Account = require('../models/Account');
const User = require('../models/User');
const Role = require('../models/Role');

const requireAuth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
      });
    }

    const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    const account = await Account.findById(decoded.accountId || decoded.id).populate('roleId');
    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại trên hệ thống.',
      });
    }

    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    let user = await User.findOne({ accountId: account._id });
    if (!user && account.email) {
      user = await User.findOne({ email: account.email });
    }

    let roleCode = 'renter';
    if (account.roleId && account.roleId.code) {
      roleCode = account.roleId.code;
    } else if (typeof account.roleId === 'string') {
      const roleDoc = await Role.findById(account.roleId);
      if (roleDoc && roleDoc.code) roleCode = roleDoc.code;
    }

    req.account = account;
    req.user = user || {
      _id: account._id,
      accountId: account._id,
      name: account.username,
      email: account.email,
      role: roleCode,
    };
    req.userRole = roleCode;

    next();
  } catch (error) {
    console.error('requireAuth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực người dùng.',
      error: error.message,
    });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng này.',
      });
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
};
