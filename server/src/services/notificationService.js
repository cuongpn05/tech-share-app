/**
 * Notification Service xử lý gửi thông báo đẩy (Push Notification)
 */
const createAndSendNotification = async ({ userId, title, body, type, relatedId, data }) => {
  try {
    // Có thể mở rộng tích hợp Expo Push Notification
    console.log(`[Notification] Gửi tới ${userId}: "${title}" - "${body}"`);
    return { success: true };
  } catch (error) {
    console.warn('[Notification] Lỗi gửi thông báo:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createAndSendNotification,
};
