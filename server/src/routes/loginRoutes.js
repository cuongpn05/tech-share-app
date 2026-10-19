/**
 * ============================================================
 *  LOGIN ROUTES  –  server/src/routes/loginRoutes.js
 * ============================================================
 *  Định nghĩa endpoint duy nhất cho luồng đăng nhập:
 *    POST /api/login  →  loginController.login
 *
 *  Đây là route public – không yêu cầu JWT token.
 *  Sau khi đăng nhập thành công, client nhận được token
 *  để sử dụng cho các route được bảo vệ khác.
 * ============================================================
 */

const express         = require('express');
const router          = express.Router();
const { login }       = require('../controllers/loginController');

/**
 * @route   POST /api/login
 * @desc    Đăng nhập người dùng bằng username/email + password
 * @access  Public
 * @body    { identifier: string, password: string }
 * @returns { success, token, user }
 */
router.post('/', login);

module.exports = router;
