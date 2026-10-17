import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { chatService } from '../../services/chatService';
import { socketService } from '../../services/socketService';
import { useAppSelector } from '../../store';
import { ChatMessage } from '../../types';
import { ConversationListSkeleton } from '../../components/common/ShimmerPlaceholders';

export interface OwnerMessagesScreenProps {
  navigation?: any;
}

export interface BookingSummary {
  bookingId: string;
  deviceName: string;
  status: string;
  statusLabel: string;
  statusType: 'completed' | 'pending' | 'rejected' | 'approved' | 'active' | 'cancelled';
  lastActivityAt?: string;
  unreadCount?: number;
}

export interface ConversationItem {
  id: string;
  bookingId: string;
  renter: {
    id: string | null;
    name: string;
    avatar: string;
    isVerified: boolean;
  };
  device: {
    id: string | null;
    name: string;
    image: string;
  };
  status: string;
  statusLabel: string;
  statusType: 'completed' | 'pending' | 'rejected' | 'approved' | 'active' | 'cancelled';
  dateFormatted: string;
  lastMessage: string;
  unreadCount: number;
  lastActivityAt?: string;
  createdAt?: string;
  otherBookingsCount?: number;
  allBookings?: BookingSummary[];
}

type FilterTab = 'all' | 'renting' | 'pending' | 'completed';

const formatMessageDate = (isoString?: string): string => {
  if (!isoString) return 'Vừa xong';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Vừa xong';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const getStatusDetails = (
  status?: string
): { label: string; type: ConversationItem['statusType'] } => {
  switch (status) {
    case 'completed':
      return { label: 'Đã hoàn tất', type: 'completed' };
    case 'pending':
      return { label: 'Chờ duyệt', type: 'pending' };
    case 'approved':
      return { label: 'Đã duyệt', type: 'approved' };
    case 'active':
      return { label: 'Đang thuê', type: 'active' };
    case 'rejected':
      return { label: 'Đã từ chối', type: 'rejected' };
    case 'cancelled':
      return { label: 'Đã hủy', type: 'cancelled' };
    default:
      return { label: (status || 'Khác').toUpperCase(), type: 'pending' };
  }
};

/**
 * Trọng số ưu tiên trạng thái đơn hàng:
 * active > pending > approved > completed > rejected / cancelled
 */
const getStatusPriority = (status?: string): number => {
  switch (status) {
    case 'active':
      return 6;
    case 'pending':
      return 5;
    case 'approved':
      return 4;
    case 'completed':
      return 3;
    case 'rejected':
      return 2;
    case 'cancelled':
      return 1;
    default:
      return 0;
  }
};

/**
 * Hàm so sánh để chọn đơn thuê đại diện cho một người dùng:
 * 1. Ưu tiên đơn có tin nhắn chưa đọc
 * 2. Ưu tiên đơn đang hoạt động (active, pending, approved) so với đơn đã xong/hủy
 * 3. Ưu tiên đơn có tin nhắn/cập nhật mới nhất
 * 4. Ưu tiên theo trọng số trạng thái
 */
const compareBookings = (a: ConversationItem, b: ConversationItem): number => {
  const unreadA = a.unreadCount || 0;
  const unreadB = b.unreadCount || 0;
  if (unreadA > 0 && unreadB === 0) return -1;
  if (unreadB > 0 && unreadA === 0) return 1;

  const priorityA = getStatusPriority(a.status);
  const priorityB = getStatusPriority(b.status);
  const isOngoingA = priorityA >= 4;
  const isOngoingB = priorityB >= 4;

  const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

  if (isOngoingA && !isOngoingB) return -1;
  if (!isOngoingA && isOngoingB) return 1;

  if (timeB !== timeA) {
    return timeB - timeA;
  }

  return priorityB - priorityA;
};

/**
 * Khóa định danh duy nhất cho đối tác chat (Counterpart User Deduplication Key)
 * Đảm bảo 1 người dùng không thể xuất hiện 2 lần trong danh sách
 */
const getCounterpartKey = (item: ConversationItem): string => {
  const normalizedName = item.renter.name ? item.renter.name.trim().toLowerCase() : '';
  const id = item.renter.id ? String(item.renter.id).trim() : '';

  const isGenericName =
    normalizedName === 'khách thuê' ||
    normalizedName === 'chủ thiết bị' ||
    normalizedName === 'người dùng' ||
    !normalizedName;

  if (!isGenericName) {
    return `name_${normalizedName}`;
  }
  if (id) {
    return `id_${id}`;
  }
  return `booking_${item.bookingId}`;
};

export const OwnerMessagesScreen: React.FC<OwnerMessagesScreenProps> = ({ navigation }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || '';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Kiểm tra đối tác hội thoại có phải là chính mình không (No Self-Chat)
  const isSelfUser = useCallback(
    (otherId?: string | null, otherName?: string | null): boolean => {
      if (!currentUser) return false;
      const myId = String(currentUser._id || (currentUser as any).id || currentUserId || '').trim();
      const myName = (currentUser.name || '').trim().toLowerCase();
      const myUsername = ((currentUser as any).username || '').trim().toLowerCase();

      if (otherId && myId && String(otherId).trim() === myId) return true;
      if (otherName) {
        const normOtherName = otherName.trim().toLowerCase();
        if (myName && normOtherName === myName) return true;
        if (myUsername && normOtherName === myUsername) return true;
      }
      return false;
    },
    [currentUser, currentUserId]
  );

  // 1. Tải danh sách hội thoại từ API GET /api/chats/conversations (dựa trên lịch sử booking thực tế)
  const fetchMessages = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await chatService.getConversations();
      if (Array.isArray(data)) {
        const defaultPartnerName =
          currentUser?.role === 'owner' ? 'Khách thuê' : 'Chủ thiết bị';

        // Lọc bỏ ngay từ nguồn nếu đối phương là chính mình
        const validData = data.filter((item) => {
          const otherId = item.otherUser?._id;
          const otherName = item.otherUser?.name;
          return !isSelfUser(otherId, otherName);
        });

        const mapped: ConversationItem[] = validData.map((item) => {
          const statusInfo = getStatusDetails(item.bookingStatus);

          let lastMessageSnippet = item.lastMessage?.text;
          if (!lastMessageSnippet) {
            switch (item.bookingStatus) {
              case 'completed':
                lastMessageSnippet = 'Đơn thuê đã hoàn tất';
                break;
              case 'active':
                lastMessageSnippet = 'Thiết bị đang được thuê';
                break;
              case 'approved':
                lastMessageSnippet = 'Đơn thuê đã được duyệt';
                break;
              case 'pending':
                lastMessageSnippet = 'Đang chờ duyệt đơn thuê';
                break;
              case 'rejected':
                lastMessageSnippet = 'Đơn thuê đã bị từ chối';
                break;
              case 'cancelled':
                lastMessageSnippet = 'Đơn thuê đã hủy';
                break;
              default:
                lastMessageSnippet = OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET;
                break;
            }
          }

          return {
            id: item.bookingId,
            bookingId: item.bookingId,
            renter: {
              id: item.otherUser?._id || null,
              name: item.otherUser?.name || defaultPartnerName,
              avatar: item.otherUser?.avatar || '',
              isVerified: Boolean(item.otherUser?.isVerified),
            },
            device: {
              id: item.device?._id || null,
              name: item.device?.title || 'Thiết bị',
              image: item.device?.image || '',
            },
            status: item.bookingStatus,
            statusLabel: statusInfo.label,
            statusType: statusInfo.type,
            unreadCount: item.unreadCount || 0,
            dateFormatted: formatMessageDate(item.lastActivityAt),
            lastMessage: lastMessageSnippet,
            lastActivityAt: item.lastActivityAt,
            createdAt: item.lastActivityAt,
          };
        });
        setConversations(mapped);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.warn('[MessagesScreen] fetch error:', err);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.role, isSelfUser]);

  // Tự động tải lại danh sách hội thoại khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  // 2. Kết nối Socket & Lắng nghe tin nhắn mới thời gian thực để cập nhật hội thoại
  useEffect(() => {
    fetchMessages();
    if (currentUserId) {
      socketService.connect(currentUserId);
    }

    // Lắng nghe new_message từ Socket.IO
    const unsubNewMsg = socketService.onNewMessage((incomingMsg: ChatMessage) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.bookingId === incomingMsg.bookingId);
        if (index === -1) {
          fetchMessages();
          return prev;
        }

        const target = prev[index];
        const isFromMe = String(incomingMsg.senderId) === String(currentUserId);
        const updatedItem: ConversationItem = {
          ...target,
          lastMessage:
            incomingMsg.text ||
            (incomingMsg.messageType === 'image'
              ? '[Hình ảnh]'
              : incomingMsg.messageType === 'location'
              ? '[Vị trí GPS]'
              : 'Tin nhắn mới'),
          unreadCount: isFromMe ? target.unreadCount : (target.unreadCount || 0) + 1,
          dateFormatted: formatMessageDate(incomingMsg.createdAt),
          lastActivityAt: incomingMsg.createdAt,
        };

        // Đưa cuộc trò chuyện có tin nhắn mới nhất lên đầu danh sách
        const withoutTarget = prev.filter((_, i) => i !== index);
        return [updatedItem, ...withoutTarget];
      });
    });

    // Lắng nghe messages_read khi đã xem tin
    const unsubRead = socketService.onMessagesRead((data: { bookingId: string }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.bookingId === data.bookingId ? { ...c, unreadCount: 0 } : c
        )
      );
    });

    return () => {
      unsubNewMsg();
      unsubRead();
    };
  }, [fetchMessages, currentUserId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages(true);
    setRefreshing(false);
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const bottomInset = Math.max(insets.bottom, 24);

  // Lọc danh sách theo Tab, Từ khóa tìm kiếm và áp dụng Quy tắc Gom nhóm theo Người dùng (Deduplication)
  const filteredConversations = useMemo(() => {
    // 1. Lọc theo trạng thái tab trước & loại bỏ hoàn toàn chat với chính mình
    const tabFiltered = conversations.filter((item) => {
      if (isSelfUser(item.renter.id, item.renter.name)) return false;

      if (activeTab === 'renting') {
        if (item.status !== 'active' && item.status !== 'approved') return false;
      } else if (activeTab === 'pending') {
        if (item.status !== 'pending') return false;
      } else if (activeTab === 'completed') {
        if (item.status !== 'completed') return false;
      }

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchRenter = item.renter.name.toLowerCase().includes(query);
        const matchDevice = item.device.name.toLowerCase().includes(query);
        if (!matchRenter && !matchDevice) return false;
      }

      return true;
    });

    // 2. Gom nhóm theo người dùng đối thoại (Group by Counterpart User)
    const groups = new Map<string, ConversationItem[]>();
    for (const item of tabFiltered) {
      const key = getCounterpartKey(item);
      const existing = groups.get(key);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    // 3. Với mỗi người dùng, chọn bản ghi đại diện tốt nhất và tổng hợp thông tin
    const deduplicated: ConversationItem[] = [];
    for (const [, group] of groups.entries()) {
      if (group.length === 0) continue;

      // Sắp xếp các đơn trong nhóm: Đơn đại diện ưu tiên nhất đứng ở vị trí [0]
      const sortedGroup = [...group].sort(compareBookings);
      const representative = sortedGroup[0];

      // Tổng số tin nhắn chưa đọc của người dùng này từ tất cả đơn
      const totalUnread = group.reduce((sum, b) => sum + (b.unreadCount || 0), 0);

      // Thời điểm hoạt động mới nhất trong nhóm
      const latestActivityTime = group.reduce((latest, b) => {
        const t = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return t > latest ? t : latest;
      }, 0);

      const latestActivityIso =
        latestActivityTime > 0
          ? new Date(latestActivityTime).toISOString()
          : representative.lastActivityAt;

      // Tìm tin nhắn mới nhất trong nhóm để hiển thị snippet nếu đơn đại diện chưa có tin nhắn
      const itemWithNewestMsg = [...group].sort((a, b) => {
        const tA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const tB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return tB - tA;
      })[0];

      const displayLastMessage =
        representative.lastMessage !== OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET
          ? representative.lastMessage
          : itemWithNewestMsg.lastMessage;

      const otherCount = group.length - 1;

      deduplicated.push({
        ...representative,
        id: representative.bookingId,
        unreadCount: totalUnread,
        lastMessage: displayLastMessage,
        lastActivityAt: latestActivityIso,
        dateFormatted: formatMessageDate(latestActivityIso),
        otherBookingsCount: otherCount,
        allBookings: group.map((b) => ({
          bookingId: b.bookingId,
          deviceName: b.device.name,
          status: b.status,
          statusLabel: b.statusLabel,
          statusType: b.statusType,
          lastActivityAt: b.lastActivityAt,
          unreadCount: b.unreadCount,
        })),
      });
    }

    // 4. Sắp xếp danh sách cuối cùng: Người có tin nhắn/hoạt động mới nhất lên đầu
    deduplicated.sort((a, b) => {
      const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return timeB - timeA;
    });

    return deduplicated;
  }, [conversations, activeTab, searchQuery]);

  const handleOpenConversation = (item: ConversationItem) => {
    // Chặn nếu đối tác là chính mình
    if (isSelfUser(item.renter.id, item.renter.name)) {
      Alert.alert('Thông báo', OWNER_STRINGS.MESSAGES.CANNOT_CHAT_WITH_SELF);
      return;
    }

    // Đánh dấu đã đọc trên giao diện cho tất cả đơn của đối tác này
    const counterpartKey = getCounterpartKey(item);
    setConversations((prev) =>
      prev.map((c) =>
        getCounterpartKey(c) === counterpartKey ? { ...c, unreadCount: 0 } : c
      )
    );

    if (navigation?.navigate) {
      navigation.navigate('ChatDetail', {
        bookingId: item.bookingId,
        otherBookings: item.allBookings,
      });
    }
  };

  const renderStatusBadge = (item: ConversationItem) => {
    let badgeStyle = styles.badgeCompleted;
    let textStyle = styles.badgeTextCompleted;

    if (item.statusType === 'pending') {
      badgeStyle = styles.badgePending;
      textStyle = styles.badgeTextPending;
    } else if (item.statusType === 'rejected') {
      badgeStyle = styles.badgeRejected;
      textStyle = styles.badgeTextRejected;
    } else if (item.statusType === 'approved' || item.statusType === 'active') {
      badgeStyle = styles.badgeApproved;
      textStyle = styles.badgeTextApproved;
    }

    return (
      <View style={[styles.statusBadge, badgeStyle]}>
        <Text style={[styles.statusBadgeText, textStyle]}>{item.statusLabel}</Text>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: ConversationItem }) => {
    const hasActiveMessage = item.lastMessage !== OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET;
    const hasUnread = Boolean(item.unreadCount && item.unreadCount > 0);

    return (
      <TouchableOpacity
        style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
        onPress={() => handleOpenConversation(item)}
        activeOpacity={0.7}
      >
        {/* Avatar đối tác chat (48x48 px kèm huy hiệu tích xanh xác thực eKYC ở góc dưới) */}
        <View style={styles.avatarContainer}>
          {item.renter.avatar ? (
            <Image source={{ uri: item.renter.avatar }} style={styles.renterAvatar} />
          ) : (
            <View
              style={[
                styles.renterAvatar,
                {
                  backgroundColor: theme.colors.brand[50],
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons name="person" size={20} color={theme.colors.brand[500]} />
            </View>
          )}
          {item.renter.isVerified && (
            <View style={styles.avatarVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.brand[500]} />
            </View>
          )}
        </View>

        {/* Nội dung tin nhắn & thông tin chi tiết */}
        <View style={styles.cardContent}>
          {/* Hàng 1: Tên đối tác + Huy hiệu xác thực + Thời gian & Unread Badge */}
          <View style={styles.topRow}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.renterNameText, hasUnread && styles.renterNameUnread]}
                numberOfLines={1}
              >
                {item.renter.name}
              </Text>
              {item.renter.isVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={theme.colors.brand[500]}
                  style={styles.verifiedIcon}
                />
              )}
            </View>

            <View style={styles.topRightBox}>
              <Text style={[styles.dateText, hasUnread && styles.dateTextUnread]}>
                {item.dateFormatted}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Hàng 2: Icon chip + Tên thiết bị + Badge đơn phụ + Badge trạng thái đơn */}
          <View style={styles.deviceRow}>
            <View style={styles.deviceInfoBox}>
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color={theme.colors.text.muted}
                style={styles.chipIcon}
              />
              <Text style={styles.deviceNameText} numberOfLines={1}>
                {item.device.name}
              </Text>
              {Boolean(item.otherBookingsCount && item.otherBookingsCount > 0) && (
                <View style={styles.otherBookingsBadge}>
                  <Text style={styles.otherBookingsText}>
                    {`(+${item.otherBookingsCount} ${OWNER_STRINGS.MESSAGES.OTHER_BOOKINGS})`}
                  </Text>
                </View>
              )}
            </View>
            {renderStatusBadge(item)}
          </View>

          {/* Hàng 3: Snippet tin nhắn gần nhất */}
          <Text
            style={[
              styles.lastMessageText,
              hasUnread
                ? styles.lastMessageUnread
                : hasActiveMessage
                ? styles.lastMessageActive
                : styles.lastMessageMuted,
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screenContainer, { paddingTop: topInset }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
        translucent={true}
      />

      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={styles.headerIconButton}
          onPress={() => {
            if (navigation?.openDrawer) {
              navigation.openDrawer();
            } else if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {currentUser?.role === 'owner'
              ? OWNER_STRINGS.MESSAGES.HEADER_TITLE
              : 'Tin nhắn'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentUser?.role === 'owner'
              ? OWNER_STRINGS.MESSAGES.HEADER_SUBTITLE
              : 'Trao đổi về các thiết bị và đơn đặt thuê'}
          </Text>
        </View>
      </View>

      {/* 2. Thanh tìm kiếm (Search Bar) */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            currentUser?.role === 'owner'
              ? OWNER_STRINGS.MESSAGES.SEARCH_PLACEHOLDER
              : 'Tìm kiếm theo tên hoặc thiết bị...'
          }
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Cụm nút lọc (Filter Tabs) */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'all' && styles.filterTabActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterTabText,
              activeTab === 'all' ? styles.filterTabTextActive : styles.filterTabTextInactive,
            ]}
          >
            {currentUser?.role === 'owner' ? OWNER_STRINGS.MESSAGES.TABS.ALL_CHATS : 'Tất cả'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'renting' && styles.filterTabActive]}
          onPress={() => setActiveTab('renting')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterTabText,
              activeTab === 'renting' ? styles.filterTabTextActive : styles.filterTabTextInactive,
            ]}
          >
            {currentUser?.role === 'owner' ? OWNER_STRINGS.MESSAGES.TABS.RENTING : 'Đang thuê'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'pending' && styles.filterTabActive]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterTabText,
              activeTab === 'pending' ? styles.filterTabTextActive : styles.filterTabTextInactive,
            ]}
          >
            {currentUser?.role === 'owner' ? OWNER_STRINGS.MESSAGES.TABS.PENDING : 'Chờ duyệt'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'completed' && styles.filterTabActive]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterTabText,
              activeTab === 'completed'
                ? styles.filterTabTextActive
                : styles.filterTabTextInactive,
            ]}
          >
            {currentUser?.role === 'owner' ? OWNER_STRINGS.MESSAGES.TABS.COMPLETED : 'Đã hoàn tất'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Danh sách các cuộc trò chuyện (Conversation List) */}
      {isLoading && conversations.length === 0 ? (
        <ConversationListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.brand[500]]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {searchQuery.trim().length > 0
                  ? OWNER_STRINGS.MESSAGES.EMPTY_SEARCH
                  : 'Chưa có cuộc trò chuyện nào từ lịch sử đặt thuê'}
              </Text>
              <Text style={styles.emptySubText}>
                Lịch sử trò chuyện sẽ tự động hiển thị theo các đơn đặt thuê của bạn.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerIconButton: {
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
  headerTitleContainer: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: theme.colors.brand[500],
    borderColor: theme.colors.brand[500],
  },
  filterTabText: {
    fontSize: 12.5,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.fontWeight.bold,
  },
  filterTabTextInactive: {
    color: '#334155',
    fontWeight: theme.typography.fontWeight.medium,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  conversationCard: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  conversationCardUnread: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
  },
  avatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  renterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceMuted,
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  renterNameText: {
    fontSize: 15.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  renterNameUnread: {
    color: '#0F172A',
    fontWeight: '800',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  topRightBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: theme.typography.fontWeight.medium,
  },
  dateTextUnread: {
    color: theme.colors.brand[600],
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: theme.colors.brand[500],
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  deviceInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chipIcon: {
    marginRight: 4,
  },
  deviceNameText: {
    fontSize: 13,
    color: theme.colors.text.muted,
    flexShrink: 1,
  },
  otherBookingsBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  otherBookingsText: {
    fontSize: 11,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
  },
  badgeCompleted: {
    backgroundColor: '#F1F5F9',
  },
  badgeTextCompleted: {
    color: '#334155',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextPending: {
    color: '#D97706',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextRejected: {
    color: '#DC2626',
  },
  badgeApproved: {
    backgroundColor: '#CCFBF1',
  },
  badgeTextApproved: {
    color: '#0D9488',
  },
  lastMessageText: {
    fontSize: 13,
    marginTop: 4,
  },
  lastMessageActive: {
    color: '#334155',
    fontWeight: theme.typography.fontWeight.medium,
  },
  lastMessageMuted: {
    color: '#94A3B8',
  },
  lastMessageUnread: {
    color: '#0F172A',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    color: theme.colors.text.muted,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});

export default OwnerMessagesScreen;
