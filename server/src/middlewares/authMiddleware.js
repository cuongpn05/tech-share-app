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
        message: 'You are not logged in or your session has expired.',
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
          message: 'Invalid or expired token. Please log in again.',
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
        message: 'Account does not exist in the system.',
      });
    }

    if (account && account.isActive === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        lockReason: account.lockReason || 'Violation of platform terms of service.',
        message: `Your account has been locked by an administrator. Reason: ${account.lockReason || 'Violation of platform terms of service.'}`,
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
      message: 'User authentication error.',
      error: error.message,
    });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
};
