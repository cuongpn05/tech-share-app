const { Expo } = require('expo-server-sdk');
const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

const expo = new Expo();

/**
 * Notification Service xử lý:
 * 1. Lưu thông báo vào Database (MongoDB Atlas)
 * 2. Bắn Socket.IO thời gian thực (Real-time in-app)
 * 3. Gửi thông báo đẩy nền (Expo Push Notification)
 */
const createAndSendNotification = async ({ userId, title, body, type, relatedId, data }) => {
  try {
    if (!userId) return { success: false, message: 'Missing userId' };

    console.log(`[Notification] Tạo thông báo cho ${userId}: "${title}" - "${body}"`);

    // 1. Lưu bản ghi thông báo vào MongoDB Atlas
    let savedNotification = null;
    try {
      let relId = null;
      if (relatedId && mongoose.Types.ObjectId.isValid(relatedId)) {
        relId = new mongoose.Types.ObjectId(relatedId);
      } else if (data?.bookingId && mongoose.Types.ObjectId.isValid(data.bookingId)) {
        relId = new mongoose.Types.ObjectId(data.bookingId);
      }

      savedNotification = await Notification.create({
        userId: new mongoose.Types.ObjectId(userId),
        type: type || 'order',
        title,
        body,
        relatedId: relId,
        isRead: false,
      });
    } catch (dbErr) {
      console.warn('[Notification] Lỗi lưu Notification vào MongoDB:', dbErr.message);
    }

    // 2. Phát sự kiện Socket.io thời gian thực tới phòng cá nhân user_${userId}
    try {
      const io = getIO();
      if (io) {
        const notifPayload = {
          _id: savedNotification ? savedNotification._id.toString() : `notif_${Date.now()}`,
          id: savedNotification ? savedNotification._id.toString() : `notif_${Date.now()}`,
          userId: String(userId),
          title,
          body,
          type: type || 'order',
          relatedId: relatedId ? String(relatedId) : (data?.bookingId ? String(data.bookingId) : undefined),
          data: data || {},
          isRead: false,
          createdAt: savedNotification?.createdAt || new Date().toISOString(),
        };

        io.to(`user_${userId}`).emit('new_notification', notifPayload);
        console.log(`[Notification] ⚡ Đã phát Socket new_notification tới user_${userId}`);
      }
    } catch (sockErr) {
      console.warn('[Notification] Lỗi phát socket notification:', sockErr.message);
    }

const { getMessagingInstance } = require('../config/firebaseAdmin');

    // 3. Gửi thông báo đẩy qua Firebase Cloud Messaging (FCM)
    (async () => {
      try {
        const messaging = getMessagingInstance();
        if (messaging) {
          const user = await User.findById(userId).select('pushConfig fcmTokens fcmToken expoPushToken');
          const fcmTokens = [
            ...(user?.pushConfig?.fcmTokens || []),
            ...(user?.fcmTokens || []),
            ...(user?.fcmToken ? [user.fcmToken] : []),
          ].filter((t, idx, arr) => t && typeof t === 'string' && arr.indexOf(t) === idx);

          const stringData = {};
          if (data && typeof data === 'object') {
            for (const [k, v] of Object.entries(data)) {
              stringData[k] = String(v ?? '');
            }
          }
          if (relatedId) stringData.relatedId = String(relatedId);
          stringData.type = String(type || 'order');

          // A. Gửi tới các FCM Device Tokens của User (nếu có)
          if (fcmTokens.length > 0) {
            try {
              const fcmPayload = {
                tokens: fcmTokens,
                notification: {
                  title,
                  body,
                },
                data: stringData,
              };
              const response = await messaging.sendEachForMulticast(fcmPayload);
              console.log(
                `[Notification] 🔥 Firebase FCM đã gửi thành công tới ${response.successCount}/${fcmTokens.length} thiết bị của user_${userId}`
              );
            } catch (fcmErr) {
              console.warn('[Notification] Lỗi gửi Firebase FCM Multicast:', fcmErr.message);
            }
          }

          // B. Gửi tới FCM Topic user_${userId}
          try {
            await messaging.send({
              topic: `user_${userId}`,
              notification: {
                title,
                body,
              },
              data: stringData,
            });
            console.log(`[Notification] 🔥 Firebase FCM đã phát tới topic user_${userId}`);
          } catch (topicErr) {
            // Bỏ qua nếu topic chưa được subscribe
          }
        }
      } catch (fcmGeneralErr) {
        console.warn('[Notification] Lỗi tiến trình Firebase Push:', fcmGeneralErr.message);
      }

      // 4. Fallback gửi qua Expo Push Notification Service nếu có token Expo
      try {
        const user = await User.findById(userId).select('expoPushToken pushTokens pushConfig');
        const token =
          user?.pushConfig?.expoPushToken ||
          user?.expoPushToken ||
          (Array.isArray(user?.pushTokens) ? user.pushTokens[0] : null);

        if (token && Expo.isExpoPushToken(token)) {
          const messages = [
            {
              to: token,
              sound: 'default',
              title: title,
              body: body,
              data: data || {
                bookingId: relatedId ? String(relatedId) : undefined,
              },
            },
          ];
          await expo.sendPushNotificationsAsync(messages);
          console.log(`[Notification] 📱 Push notification đã gửi qua Expo tới token ${token}`);
        }
      } catch (pushErr) {
        console.warn('[Notification] Lỗi gửi Expo Push:', pushErr.message);
      }
    })();

    return { success: true, data: savedNotification };
  } catch (error) {
    console.warn('[Notification] Lỗi xử lý thông báo tổng thể:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createAndSendNotification,
};
