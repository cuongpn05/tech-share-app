import { apiClient } from '../config/api';

export interface AppNotification {
  _id: string;
  id?: string;
  userId: string;
  type: 'order' | 'message' | 'promo' | 'system' | string;
  title: string;
  body: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

type UnreadCountListener = (count: number) => void;
let unreadCountListeners: UnreadCountListener[] = [];
let cachedUnreadCount = 0;

export const notificationService = {
  getUnreadCountCached: () => cachedUnreadCount,

  onUnreadCountChange: (listener: UnreadCountListener) => {
    unreadCountListeners.push(listener);
    // Gọi ngay giá trị hiện tại
    try {
      listener(cachedUnreadCount);
    } catch {}
    return () => {
      unreadCountListeners = unreadCountListeners.filter((l) => l !== listener);
    };
  },

  setUnreadCount: (count: number) => {
    cachedUnreadCount = Math.max(0, count);
    unreadCountListeners.forEach((fn) => {
      try {
        fn(cachedUnreadCount);
      } catch (err) {
        console.warn('[NotificationService] Lỗi listener unreadCount:', err);
      }
    });
  },

  incrementUnreadCount: () => {
    notificationService.setUnreadCount(cachedUnreadCount + 1);
  },

  decrementUnreadCount: () => {
    notificationService.setUnreadCount(cachedUnreadCount - 1);
  },

  clearUnreadCount: () => {
    notificationService.setUnreadCount(0);
  },

  fetchUnreadCount: async (userId?: string): Promise<number> => {
    try {
      const res = await apiClient.get('/notifications', {
        params: { isRead: false, limit: 1, ...(userId ? { userId } : {}) },
      });
      const unread = typeof res.data?.unreadCount === 'number' ? res.data.unreadCount : 0;
      notificationService.setUnreadCount(unread);
      return unread;
    } catch (error) {
      console.warn('[NotificationService] Lỗi tải số thông báo chưa đọc:', error);
      return cachedUnreadCount;
    }
  },

  getMyNotifications: async (params?: { type?: string; isRead?: boolean; page?: number; limit?: number }) => {
    try {
      const res = await apiClient.get('/notifications', { params });
      if (typeof res.data?.unreadCount === 'number') {
        notificationService.setUnreadCount(res.data.unreadCount);
      }
      return res.data;
    } catch (error) {
      console.warn('[NotificationService] Lỗi tải danh sách thông báo:', error);
      return { success: false, data: [], count: 0, unreadCount: cachedUnreadCount };
    }
  },

  markAsRead: async (id: string) => {
    try {
      // Giảm ngay 1 thông báo cục bộ để UI phản hồi tức thì
      notificationService.decrementUnreadCount();
      const res = await apiClient.patch(`/notifications/${id}/read`);
      if (typeof res.data?.unreadCount === 'number') {
        notificationService.setUnreadCount(res.data.unreadCount);
      }
      return res.data;
    } catch (error) {
      console.warn('[NotificationService] Lỗi đánh dấu đã đọc:', error);
      return { success: false };
    }
  },

  markAllAsRead: async () => {
    try {
      // Đặt ngay về 0 cục bộ để UI phản hồi tức thì
      notificationService.clearUnreadCount();
      const res = await apiClient.patch('/notifications/read-all');
      if (typeof res.data?.unreadCount === 'number') {
        notificationService.setUnreadCount(res.data.unreadCount);
      }
      return res.data;
    } catch (error) {
      console.warn('[NotificationService] Lỗi đánh dấu đọc tất cả:', error);
      return { success: false };
    }
  },

  registerFCMToken: async (fcmToken: string) => {
    try {
      const res = await apiClient.post('/notifications/fcm-token', { fcmToken });
      return res.data;
    } catch (error) {
      console.warn('[NotificationService] Lỗi đăng ký FCM token:', error);
      return { success: false };
    }
  },
};

export default notificationService;
