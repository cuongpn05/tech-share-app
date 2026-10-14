const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Endpoint đăng nhập
router.post('/login', authController.login);

// Endpoint lấy thông tin profile từ token
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
