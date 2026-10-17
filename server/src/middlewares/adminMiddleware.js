/**
 * Middleware bảo vệ phân quyền Admin
 * Chỉ tài khoản có role 'admin' mới được truy cập.
 * Vi phạm trả về 403 FORBIDDEN_ADMIN_ONLY.
 */
const adminMiddleware = (req, res, next) => {
  const role = req.userRole || req.user?.role || req.auth?.role;
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'FORBIDDEN_ADMIN_ONLY',
      error: 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập chức năng này.',
    });
  }
  next();
};

module.exports = {
  adminMiddleware,
};
