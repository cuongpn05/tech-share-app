const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

// Endpoint đăng nhập
router.post('/login', authController.login);

// Endpoint lấy thông tin profile từ token
router.get('/me', requireAuth, authController.getMe);

// Endpoint upload avatar lên Cloudinary và lưu vào database
router.post('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.patch('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.post('/me/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);

module.exports = router;
