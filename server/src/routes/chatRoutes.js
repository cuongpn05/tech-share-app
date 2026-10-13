const express = require('express');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadDeviceImage } = require('../middlewares/uploadMiddleware');
const {
  getConversations,
  getChatHistory,
  sendMessage,
  uploadChatImage,
  markChatMessagesAsRead,
} = require('../controllers/chatController');

const router = express.Router();

// Upload ảnh đính kèm trong chat
router.post('/upload-image', requireAuth, uploadDeviceImage, uploadChatImage);

// Lấy danh sách các cuộc hội thoại (tin mới nhất đưa lên đầu)
router.get('/conversations', requireAuth, getConversations);

// Lấy toàn bộ lịch sử tin nhắn của đơn thuê
router.get('/:bookingId', requireAuth, getChatHistory);

// Gửi tin nhắn mới
router.post('/:bookingId/messages', requireAuth, sendMessage);

// Đánh dấu các tin nhắn trong đơn là đã đọc
router.patch('/:bookingId/read', requireAuth, markChatMessagesAsRead);

module.exports = router;
