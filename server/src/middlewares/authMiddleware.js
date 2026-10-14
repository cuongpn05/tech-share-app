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
      try {
        decoded = jwt.verify(token, 'techshare_secret_key');
      } catch {
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        });
      }
    }

    let account = null;
    let user = null;

    if (decoded.accountId) {
      account = await Account.findById(decoded.accountId).populate('roleId');
    }
    if (decoded.id) {
      user = await User.findById(decoded.id);
    }
    if (!account && user && user.accountId) {
      account = await Account.findById(user.accountId).populate('roleId');
    }
    if (!user && account) {
      user = await User.findOne({ accountId: account._id });
    }
    if (!account && decoded.id) {
      account = await Account.findById(decoded.id).populate('roleId');
    }

    if (!user && !account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại trên hệ thống.',
      });
    }

    if (account && account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    let roleCode = user?.role || (account?.roleId && account.roleId.code) || decoded.role || 'renter';
    const currentUserId = user ? user._id.toString() : (account ? account._id.toString() : String(decoded.id));

    req.account = account;
    req.user = user || {
      _id: currentUserId,
      accountId: account?._id || currentUserId,
      name: account?.username || decoded.name || 'User',
      email: account?.email || decoded.email,
      role: roleCode,
    };
    req.userRole = roleCode;
    req.auth = {
      id: currentUserId,
      userId: currentUserId,
      _id: currentUserId,
      role: roleCode,
      name: user?.name || account?.username || decoded.name,
    };

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
