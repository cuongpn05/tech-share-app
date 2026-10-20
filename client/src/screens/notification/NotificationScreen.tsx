import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { chatService } from '../../services/chatService';
import { notificationService } from '../../services/notificationService';
import { socketService, InAppNotification } from '../../services/socketService';
import { useAppSelector } from '../../store';
import { NotificationListSkeleton } from '../../components/common/ShimmerPlaceholders';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'booking' | 'system';
  bookingId?: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationScreenProps {
  navigation?: any;
}

export const NotificationScreen: React.FC<NotificationScreenProps> = ({ navigation }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'message' | 'booking'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tải danh sách thông báo thực tế tổng hợp từ MongoDB notifications & các cuộc hội thoại
  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const notifs: NotificationItem[] = [];
      const seenIds = new Set<string>();

      // 1. Tải danh sách thông báo chính thức lưu trong MongoDB Atlas
      try {
        const notifRes = await notificationService.getMyNotifications({ limit: 50 });
        if (notifRes?.success && Array.isArray(notifRes.data)) {
          notifRes.data.forEach((n: any) => {
            const notifId = n._id || n.id;
            seenIds.add(notifId);
            notifs.push({
              id: notifId,
              title: n.title,
              body: n.body,
              type: n.type === 'message' ? 'message' : 'booking',
              bookingId: n.relatedId || n.data?.bookingId,
              createdAt: n.createdAt || new Date().toISOString(),
              isRead: Boolean(n.isRead),
            });
          });
        }
      } catch (dbErr) {
        console.warn('[NotificationScreen] Lỗi tải từ notificationService:', dbErr);
      }

      // 2. Bổ sung thông báo tin nhắn trao đổi từ chatService nếu chưa có
      try {
        const convs = await chatService.getConversations();
        if (Array.isArray(convs)) {
          convs.forEach((c) => {
            if (c.lastMessage) {
              const msgId = `msg_${c.bookingId}_${c.lastMessage._id || Date.now()}`;
              if (!seenIds.has(msgId)) {
                notifs.push({
                  id: msgId,
                  title: `${c.otherUser?.name || 'Đối tác'} đã gửi tin nhắn`,
                  body: c.lastMessage.text || 'Bạn có tin nhắn mới',
                  type: 'message',
                  bookingId: c.bookingId,
                  createdAt: c.lastMessage.createdAt || c.lastActivityAt || new Date().toISOString(),
                  isRead: (c.unreadCount || 0) === 0,
                });
              }
            }
          });
        }
      } catch (chatErr) {
        console.warn('[NotificationScreen] Lỗi tải từ chatService:', chatErr);
      }

      // Sắp xếp thông báo mới nhất lên đầu
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    } catch (err) {
      console.warn('[NotificationScreen] Lỗi tải thông báo:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    // Lắng nghe socket notification thời gian thực
    const unsubNotif = socketService.onNotification((notif: InAppNotification) => {
      notificationService.incrementUnreadCount();
      const newItem: NotificationItem = {
        id: notif._id || `notif_${Date.now()}`,
        title: notif.title || 'Thông báo mới',
        body: notif.body || '',
        type: (notif.type as any) === 'message' ? 'message' : 'booking',
        bookingId: notif.data?.bookingId || notif.relatedId,
        createdAt: notif.createdAt || new Date().toISOString(),
        isRead: false,
      };
      setNotifications((prev) => [newItem, ...prev]);
    });

    const unsubMsg = socketService.onNewMessage((msg) => {
      if (String(msg.senderId) === String(currentUserId)) return;
      loadNotifications(true);
    });

    return () => {
      unsubNotif();
      unsubMsg();
    };
  }, [loadNotifications, currentUserId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(true);
    setRefreshing(false);
  };

  const handlePressItem = (item: NotificationItem) => {
    // Đánh dấu đã đọc cục bộ và giảm số lượng thông báo nếu chưa đọc
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );

      // Gửi cập nhật lên backend nếu là notification từ DB
      if (!item.id.startsWith('msg_') && !item.id.startsWith('booking_')) {
        notificationService.markAsRead(item.id);
      } else {
        notificationService.decrementUnreadCount();
      }
    }

    if (navigation?.navigate) {
      if (item.type === 'booking') {
        if (currentUser?.role === 'owner') {
          navigation.navigate('OwnerPendingBookings');
        } else if (item.bookingId) {
          navigation.navigate('BookingDetail', { bookingId: item.bookingId });
        }
      } else if (item.bookingId) {
        navigation.navigate('ChatDetail', { bookingId: item.bookingId });
      }
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationService.markAllAsRead();
  };

  const filteredList = notifications.filter((item) => {
    if (activeTab === 'message') return item.type === 'message';
    if (activeTab === 'booking') return item.type === 'booking';
    return true;
  });

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const bottomInset = Math.max(insets.bottom, 24);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={styles.headerMenuButton}
          onPress={() => {
            if (navigation?.openDrawer) {
              navigation.openDrawer();
            } else if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSubtitle}>Cập nhật tin nhắn và đơn thuê</Text>
        </View>

        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
          <Text style={styles.markAllText}>Đã đọc hết</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Tất cả</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'message' && styles.tabActive]}
          onPress={() => setActiveTab('message')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'message' && styles.tabTextActive]}>Tin nhắn</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'booking' && styles.tabActive]}
          onPress={() => setActiveTab('booking')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>Đơn thuê</Text>
        </TouchableOpacity>
      </View>

      {/* List Notifications */}
      {isLoading && notifications.length === 0 ? (
        <NotificationListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.brand[500]]} />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 16 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isMsg = item.type === 'message';
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
                onPress={() => handlePressItem(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBox, isMsg ? styles.iconBoxMsg : styles.iconBoxBooking]}>
                  <Ionicons
                    name={isMsg ? 'chatbubble-ellipses' : 'receipt'}
                    size={20}
                    color={isMsg ? '#0D9488' : '#3B82F6'}
                  />
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleBold]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.cardBody} numberOfLines={2}>
                    {item.body}
                  </Text>

                  <Text style={styles.cardTime}>
                    {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-off-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
              <Text style={styles.emptySub}>Các cập nhật mới nhất về tin nhắn và đơn thuê sẽ xuất hiện tại đây.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.brand[500],
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    backgroundColor: theme.colors.background,
    gap: 8,
    marginBottom: 6,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabActive: {
    backgroundColor: theme.colors.brand[500],
    borderColor: theme.colors.brand[500],
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 4,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'flex-start',
    ...theme.shadows.card,
  },
  notifCardUnread: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBoxMsg: {
    backgroundColor: '#CCFBF1',
  },
  iconBoxBooking: {
    backgroundColor: '#DBEAFE',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  cardTitleBold: {
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.brand[500],
    marginLeft: 6,
  },
  cardBody: {
    fontSize: 13,
    color: theme.colors.text.muted,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 11.5,
    color: theme.colors.text.subtle,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default NotificationScreen;
