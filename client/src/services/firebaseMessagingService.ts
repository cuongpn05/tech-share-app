import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import app from '../config/firebase';
import { apiClient } from '../config/api';

export const firebaseMessagingService = {
  /**
   * Khởi tạo Firebase Cloud Messaging (FCM)
   * Yêu cầu quyền thông báo đẩy và đăng ký FCM Token với server
   */
  init: async (userId?: string): Promise<string | null> => {
    try {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        console.log('[FirebaseMessaging] FCM Push Messaging không khả dụng ở môi trường hiện tại');
        return null;
      }

      const messaging = getMessaging(app);

      // Yêu cầu quyền nhận thông báo đẩy
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('[FirebaseMessaging] Quyền thông báo đẩy chưa được cấp');
          return null;
        }
      }

      // Lấy FCM Token từ Firebase
      const currentToken = await getToken(messaging);

      if (currentToken) {
        console.log('[FirebaseMessaging] 🔥 Lấy FCM push token thành công:', currentToken.substring(0, 15) + '...');

        // Gửi token lên Backend lưu trữ cho tài khoản hiện tại
        try {
          await apiClient.post('/notifications/fcm-token', {
            fcmToken: currentToken,
            userId,
          });
          console.log('[FirebaseMessaging] Đã đồng bộ FCM push token lên server');
        } catch (apiErr) {
          console.warn('[FirebaseMessaging] Lỗi gửi token lên backend:', apiErr);
        }

        // Lắng nghe thông báo đẩy Firebase khi app đang mở (Foreground)
        onMessage(messaging, (payload) => {
          console.log('[FirebaseMessaging] 📩 Nhận thông báo Firebase push:', payload.notification?.title);
          // Không hiển thị modal Alert popup theo yêu cầu
        });

        return currentToken;
      }
    } catch (err: any) {
      console.warn('[FirebaseMessaging] Cảnh báo thiết lập Firebase push notification:', err?.message || err);
    }
    return null;
  },

  /**
   * Đăng ký token trực tiếp lên server
   */
  registerTokenToServer: async (token: string, userId?: string): Promise<boolean> => {
    try {
      await apiClient.post('/notifications/fcm-token', {
        fcmToken: token,
        userId,
      });
      return true;
    } catch {
      return false;
    }
  },
};

export default firebaseMessagingService;
