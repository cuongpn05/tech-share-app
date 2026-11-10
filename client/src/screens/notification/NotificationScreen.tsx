import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { colors } from '../../theme/colors';
import { chatService } from '../../services/chatService';
import { notificationService } from '../../services/notificationService';
import { socketService, InAppNotification } from '../../services/socketService';
import { useAppSelector } from '../../store';
import { NotificationListSkeleton } from '../../components/common/ShimmerPlaceholders';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'booking' | 'system' | 'reminder';
  bookingId?: string;
  bookingCode?: string;
  bookingStatus?: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationScreenProps {
  navigation?: any;
}

function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}

function extractBookingCode(text: string): string | null {
  const match = text.match(/#([A-Z0-9_-]+)/i);
  return match ? `#${match[1]}` : null;
}

function getBookingStatusInfo(status?: string, title?: string, body?: string) {
  const fullText = `${title || ''} ${body || ''}`.toLowerCase();

  if (
    status === 'approved' ||
    fullText.includes('approved') ||
    fullText.includes('đã được duyệt') ||
    fullText.includes('phê duyệt')
  ) {
    return {
      label: 'Approved',
      color: colors.light.success,
      bg: '#ECFDF5',
      icon: 'checkmark-circle' as const,
    };
  }
  if (
    status === 'active' ||
    fullText.includes('active') ||
    fullText.includes('handover') ||
    fullText.includes('bàn giao')
  ) {
    return {
      label: 'Active Rental',
      color: colors.light.primaryDark,
      bg: colors.light.primaryLight,
      icon: 'hardware-chip' as const,
    };
  }
  if (
    status === 'completed' ||
    fullText.includes('completed') ||
    fullText.includes('hoàn tất')
  ) {
    return {
      label: 'Completed',
      color: '#6366F1',
      bg: '#EEF2FF',
      icon: 'sparkles' as const,
    };
  }
  if (
    status === 'cancelled' ||
    status === 'rejected' ||
    fullText.includes('cancelled') ||
    fullText.includes('declined') ||
    fullText.includes('bị hủy') ||
    fullText.includes('từ chối')
  ) {
    return {
      label: status === 'rejected' || fullText.includes('declined') ? 'Declined' : 'Cancelled',
      color: colors.light.error,
      bg: '#FEF2F2',
      icon: 'close-circle' as const,
    };
  }
  if (
    fullText.includes('due') ||
    fullText.includes('reminder') ||
    fullText.includes('extension') ||
    fullText.includes('hạn trả') ||
    fullText.includes('gia hạn')
  ) {
    return {
      label: 'Due Soon',
      color: '#D97706',
      bg: '#FEF3C7',
      icon: 'alarm' as const,
    };
  }
  return {
    label: 'Pending',
    color: '#D97706',
    bg: '#FEF3C7',
    icon: 'time' as const,
  };
}

export const NotificationScreen: React.FC<NotificationScreenProps> = ({ navigation }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'booking' | 'message' | 'reminder'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tải danh sách thông báo từ Backend MongoDB & Chat Conversations
  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const notifs: NotificationItem[] = [];
      const seenIds = new Set<string>();

      // 1. Tải danh sách thông báo chính thức lưu trong DB
      try {
        const notifRes = await notificationService.getMyNotifications({ limit: 60 });
        if (notifRes?.success && Array.isArray(notifRes.data)) {
          notifRes.data.forEach((n: any) => {
            const notifId = n._id || n.id;
            seenIds.add(notifId);
            const isMsgType = n.type === 'message';
            const bId = n.relatedId || n.data?.bookingId;
            const bCode = (n.data as any)?.bookingCode || extractBookingCode(`${n.title} ${n.body}`);
            const bStatus = (n.data as any)?.status;

            let finalType: NotificationItem['type'] = 'booking';
            if (isMsgType) finalType = 'message';
            else if (n.type === 'reminder' || `${n.title} ${n.body}`.toLowerCase().includes('due')) {
              finalType = 'reminder';
            }

            notifs.push({
              id: notifId,
              title: n.title,
              body: n.body,
              type: finalType,
              bookingId: bId,
              bookingCode: bCode || undefined,
              bookingStatus: bStatus,
              createdAt: n.createdAt || new Date().toISOString(),
              isRead: Boolean(n.isRead),
            });
          });
        }
      } catch (dbErr) {
        console.warn('[NotificationScreen] Error loading from notificationService:', dbErr);
      }

      // 2. Bổ sung tin nhắn trao đổi từ chatService nếu chưa có
      try {
        const convs = await chatService.getConversations();
        if (Array.isArray(convs)) {
          convs.forEach((c) => {
            if (c.lastMessage) {
              const msgId = `msg_${c.bookingId}_${c.lastMessage._id || Date.now()}`;
              if (!seenIds.has(msgId)) {
                notifs.push({
                  id: msgId,
                  title: `${c.otherUser?.name || 'Customer'} sent a message`,
                  body: c.lastMessage.text || 'You have a new message regarding your rental order',
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
        console.warn('[NotificationScreen] Error loading from chatService:', chatErr);
      }

      // Sắp xếp mới nhất lên đầu
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    } catch (err) {
      console.warn('[NotificationScreen] Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    // Lắng nghe socket notification thời gian thực
    const unsubNotif = socketService.onNotification((notif: InAppNotification) => {
      notificationService.incrementUnreadCount();
      const bId = notif.data?.bookingId || notif.relatedId;
      const bCode = (notif.data as any)?.bookingCode || extractBookingCode(`${notif.title} ${notif.body}`);
      const isMsg = notif.type === 'message';

      const newItem: NotificationItem = {
        id: notif._id || `notif_${Date.now()}`,
        title: notif.title || 'New booking notification',
        body: notif.body || '',
        type: isMsg ? 'message' : 'booking',
        bookingId: bId,
        bookingCode: bCode || undefined,
        bookingStatus: (notif.data as any)?.status,
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
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      if (!item.id.startsWith('msg_')) {
        notificationService.markAsRead(item.id);
      } else {
        notificationService.decrementUnreadCount();
      }
    }

    if (navigation?.navigate) {
      if (item.type === 'message') {
        if (item.bookingId) {
          navigation.navigate('ChatDetail', { bookingId: item.bookingId });
        }
      } else if (item.type === 'booking' || item.type === 'reminder') {
        if (currentUser?.role === 'owner' && item.bookingStatus === 'pending') {
          navigation.navigate('OwnerPendingBookings');
        } else if (item.bookingId) {
          navigation.navigate('BookingDetail', { bookingId: item.bookingId });
        }
      }
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationService.markAllAsRead();
  };

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: notifications.length,
      booking: notifications.filter((n) => n.type === 'booking').length,
      message: notifications.filter((n) => n.type === 'message').length,
      reminder: notifications.filter((n) => n.type === 'reminder').length,
      bookingUnread: notifications.filter((n) => n.type === 'booking' && !n.isRead).length,
    };
  }, [notifications]);

  const filteredList = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === 'message') return item.type === 'message';
      if (activeTab === 'booking') return item.type === 'booking';
      if (activeTab === 'reminder') return item.type === 'reminder';
      return true;
    });
  }, [notifications, activeTab]);

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
          <Ionicons name="menu-outline" size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Rental updates & direct chats</Text>
        </View>

        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
          <Ionicons name="checkmark-done" size={15} color={colors.light.primaryDark} style={{ marginRight: 4 }} />
          <Text style={styles.markAllText}>Mark all</Text>
        </TouchableOpacity>
      </View>

      {/* Pill Filter Tabs (Strictly following theme-skill.md) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'booking' && styles.tabActive]}
          onPress={() => setActiveTab('booking')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="receipt-outline"
            size={14}
            color={activeTab === 'booking' ? colors.light.primaryDark : colors.light.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>Bookings</Text>
          {tabCounts.bookingUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{tabCounts.bookingUnread}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'message' && styles.tabActive]}
          onPress={() => setActiveTab('message')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={14}
            color={activeTab === 'message' ? colors.light.primaryDark : colors.light.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, activeTab === 'message' && styles.tabTextActive]}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'reminder' && styles.tabActive]}
          onPress={() => setActiveTab('reminder')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="alarm-outline"
            size={14}
            color={activeTab === 'reminder' ? colors.light.primaryDark : colors.light.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabText, activeTab === 'reminder' && styles.tabTextActive]}>Reminders</Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      {isLoading && notifications.length === 0 ? (
        <NotificationListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.light.primary]}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 20 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isMsg = item.type === 'message';
            const statusInfo = getBookingStatusInfo(item.bookingStatus, item.title, item.body);
            const timeAgo = getRelativeTime(item.createdAt);

            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
                onPress={() => handlePressItem(item)}
                activeOpacity={0.8}
              >
                {/* Status Indicator Icon */}
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isMsg ? '#F0FDFA' : statusInfo.bg },
                  ]}
                >
                  <Ionicons
                    name={isMsg ? 'chatbubble-ellipses' : statusInfo.icon}
                    size={20}
                    color={isMsg ? colors.light.primaryDark : statusInfo.color}
                  />
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  {/* Top Meta Line: Type tag + Booking code + Status badge + Time */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaLeftGroup}>
                      <Text style={styles.categoryTag}>
                        {isMsg ? 'MESSAGE' : 'BOOKING'}
                      </Text>
                      {item.bookingCode ? (
                        <View style={styles.codePill}>
                          <Text style={styles.codePillText}>{item.bookingCode}</Text>
                        </View>
                      ) : null}
                      {!isMsg && (
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardTime}>{timeAgo}</Text>
                  </View>

                  {/* Title & Body */}
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.cardTitle, !item.isRead && styles.cardTitleBold]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.cardBody} numberOfLines={2}>
                    {item.body}
                  </Text>

                  {/* Quick Action Button for Bookings */}
                  {item.bookingId && (
                    <View style={styles.quickActionRow}>
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => handlePressItem(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickActionText}>
                          {isMsg ? 'Reply' : 'View Booking'}
                        </Text>
                        <Ionicons name="chevron-forward" size={13} color={colors.light.primaryDark} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-outline" size={42} color={colors.light.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>
                Updates on rental requests, approvals, and device handover schedules will appear here.
              </Text>
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
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.light.primaryBg,
    borderRadius: 9999,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.light.background,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9999, // Pill shape
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  tabActive: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  tabTextActive: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: colors.light.primaryDark,
    borderRadius: 9999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.light.white,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.light.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  notifCardUnread: {
    borderColor: colors.light.primaryLight,
    backgroundColor: '#FAFEFF',
    borderLeftWidth: 3.5,
    borderLeftColor: colors.light.primary,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardTime: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
    flex: 1,
  },
  cardTitleBold: {
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.light.primary,
    marginLeft: 6,
  },
  cardBody: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    lineHeight: 18,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default NotificationScreen;
