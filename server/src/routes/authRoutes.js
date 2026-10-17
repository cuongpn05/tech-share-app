const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Endpoint đăng nhập
router.post('/login', authController.login);

// Endpoint lấy thông tin profile từ token
router.get('/me', requireAuth, authController.getMe);

// Endpoint cập nhật thông tin cá nhân
router.put('/me', requireAuth, authController.updateMe);

module.exports = router;
