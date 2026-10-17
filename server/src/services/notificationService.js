const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

/**
 * Notification Service xử lý gửi thông báo đẩy (Push Notification)
 */
const createAndSendNotification = async ({ userId, title, body, type, relatedId, data }) => {
  try {
    console.log(`[Notification] Gửi tới ${userId}: "${title}" - "${body}"`);

    if (!userId) return { success: false, message: 'Missing userId' };

    const user = await User.findById(userId).select('expoPushToken pushTokens');
    const token = user?.expoPushToken || user?.pushTokens?.[0];

    if (token && Expo.isExpoPushToken(token)) {
      const messages = [
        {
          to: token,
          sound: 'default',
          title: title,
          body: body,
          data: data || {
            screen: 'ChatDetail',
            bookingId: relatedId ? String(relatedId) : undefined,
          },
        },
      ];
      await expo.sendPushNotificationsAsync(messages);
      console.log(`[Notification] Push notification đã gửi qua Expo tới token ${token}`);
    }

    return { success: true };
  } catch (error) {
    console.warn('[Notification] Lỗi gửi thông báo:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createAndSendNotification,
};
