const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

// User login endpoint
router.post('/login', authController.login);

// Retrieve authenticated user profile
router.get('/me', requireAuth, authController.getMe);

// Update user personal profile
router.put('/me', requireAuth, authController.updateMe);

// Upload avatar to Cloudinary and update database
router.post('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.patch('/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);
router.post('/me/avatar', requireAuth, uploadFlexibleImage, authController.updateAvatar);

module.exports = router;
