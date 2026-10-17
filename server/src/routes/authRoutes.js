const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Endpoint đăng nhập
router.post('/login', authController.login);

// Endpoint quy trình đăng ký tài khoản với OTP Email
router.post('/register/send-otp', authController.sendRegisterOtp);
router.post('/register/verify-otp', authController.verifyRegisterOtp);
router.post('/register/resend-otp', authController.resendRegisterOtp);

// Endpoint lấy thông tin profile từ token
router.get('/me', requireAuth, authController.getMe);

// Endpoint cập nhật thông tin cá nhân
router.put('/me', requireAuth, authController.updateMe);

module.exports = router;
