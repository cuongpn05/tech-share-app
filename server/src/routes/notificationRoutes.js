const express = require('express');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerFCMToken,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, getMyNotifications);
router.patch('/read-all', requireAuth, markAllAsRead);
router.patch('/:id/read', requireAuth, markAsRead);
router.post('/fcm-token', requireAuth, registerFCMToken);

module.exports = router;
