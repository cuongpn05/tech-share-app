const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

// User login endpoint
router.post('/login', authController.login);

// Endpoint quy trình đăng ký tài khoản với OTP Email
router.post('/register/send-otp', authController.sendRegisterOtp);
router.post('/register/verify-otp', authController.verifyRegisterOtp);
router.post('/register/resend-otp', authController.resendRegisterOtp);

// Endpoint lấy thông tin profile từ token
router.get('/me', requireAuth, authController.getMe);

// Update user personal profile
router.put('/me', requireAuth, authController.updateMe);

// Upload avatar to Cloudinary and update database
router.post('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.patch('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.post('/me/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);

module.exports = router;
