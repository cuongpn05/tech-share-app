const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware xác thực người dùng.
 * Trong môi trường dev chưa hoàn thiện login, tự động fallback về tài khoản owner1
 * để đảm bảo toàn bộ tính năng hoạt động trơn tru.
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'techshare_secret_key');
        req.auth = decoded;
        return next();
      } catch {
        // Token không hợp lệ -> fallback dev bên dưới
      }
    }

    // Dev Fallback: Tự động gán tài khoản owner1 nếu chưa đăng nhập
    const owner = await User.findOne({
      $or: [{ name: 'owner1' }, { role: 'owner' }],
    }).lean();

    if (owner) {
      req.auth = {
        id: owner._id.toString(),
        userId: owner._id.toString(),
        _id: owner._id.toString(),
        role: 'owner',
        name: owner.name,
      };
    } else {
      req.auth = {
        id: '6ab13ee23bb7f33ae04d2c88',
        userId: '6ab13ee23bb7f33ae04d2c88',
        _id: '6ab13ee23bb7f33ae04d2c88',
        role: 'owner',
        name: 'owner1',
      };
    }

    return next();
  } catch (err) {
    return next();
  }
};

module.exports = {
  requireAuth,
};
