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
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { chatService } from '../../services/chatService';
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

  // Tải danh sách thông báo thực tế tổng hợp từ các cuộc hội thoại & đơn thuê
  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const convs = await chatService.getConversations();
      if (Array.isArray(convs)) {
        const notifs: NotificationItem[] = [];

        convs.forEach((c) => {
          // 1. Thông báo tin nhắn gần nhất
          if (c.lastMessage) {
            notifs.push({
              id: `msg_${c.bookingId}_${c.lastMessage._id || Date.now()}`,
              title: `${c.otherUser?.name || 'Đối tác'} đã gửi tin nhắn`,
              body: c.lastMessage.text || 'Bạn có tin nhắn mới',
              type: 'message',
              bookingId: c.bookingId,
              createdAt: c.lastMessage.createdAt || c.lastActivityAt || new Date().toISOString(),
              isRead: (c.unreadCount || 0) === 0,
            });
          }

          // 2. Thông báo cập nhật trạng thái đơn
          let statusText = '';
          if (c.bookingStatus === 'completed') statusText = 'Đơn thuê thiết bị đã hoàn tất thành công';
          else if (c.bookingStatus === 'approved') statusText = 'Đơn thuê thiết bị đã được chủ máy phê duyệt';
          else if (c.bookingStatus === 'active') statusText = 'Thiết bị đang trong thời gian cho thuê';

          if (statusText) {
            notifs.push({
              id: `booking_${c.bookingId}`,
              title: `Cập nhật đơn thuê: ${c.device?.title || 'Thiết bị'}`,
              body: statusText,
              type: 'booking',
              bookingId: c.bookingId,
              createdAt: c.lastActivityAt || new Date().toISOString(),
              isRead: true,
            });
          }
        });

        // Sắp xếp thông báo mới nhất lên đầu
        notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(notifs);
      }
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
      const newItem: NotificationItem = {
        id: notif._id || `notif_${Date.now()}`,
        title: notif.title || 'Thông báo mới',
        body: notif.body || '',
        type: (notif.type as any) || 'message',
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
    // Đánh dấu đã đọc
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );

    if (item.bookingId && navigation?.navigate) {
      navigation.navigate('ChatDetail', { bookingId: item.bookingId });
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filteredList = notifications.filter((item) => {
    if (activeTab === 'message') return item.type === 'message';
    if (activeTab === 'booking') return item.type === 'booking';
    return true;
  });

  const statusBarOffset = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <View style={[styles.container, { paddingTop: statusBarOffset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={true} />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation?.canGoBack?.()) navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
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
          contentContainerStyle={styles.listContent}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#0D9488',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  notifCardUnread: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
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
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  cardTitleBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D9488',
    marginLeft: 6,
  },
  cardBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
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
