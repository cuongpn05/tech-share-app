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
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';

export interface OwnerMessagesScreenProps {
  navigation?: any;
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
  createdAt?: string;
}

type FilterTab = 'all' | 'renting' | 'pending' | 'completed';

export const OwnerMessagesScreen: React.FC<OwnerMessagesScreenProps> = ({ navigation }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Dữ liệu dự phòng khớp 100% với database MongoDB Atlas
  const fallbackConversations: ConversationItem[] = useMemo(
    () => [
      {
        id: '6ac4ad847256044589f824da',
        bookingId: '6ac4ad847256044589f824da',
        renter: {
          id: 'renter1',
          name: 'renter1',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
          isVerified: false,
        },
        device: {
          id: 'dev_macbook',
          name: 'MacBook Pro 16 inch M3 Max (36...',
          image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
        },
        status: 'completed',
        statusLabel: 'Completed',
        statusType: 'completed',
        dateFormatted: '11/10',
        lastMessage: 'I have arrived at the handover location.',
      },
      {
        id: '6acb43faf6cae125e60d7c52',
        bookingId: '6acb43faf6cae125e60d7c52',
        renter: {
          id: 'cust_canon',
          name: 'Customer',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
          isVerified: false,
        },
        device: {
          id: 'dev_canon',
          name: 'Canon PowerShot G7 X Mark III',
          image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
        },
        status: 'pending',
        statusLabel: 'Pending',
        statusType: 'pending',
        dateFormatted: '11/10',
        lastMessage: OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET,
      },
      {
        id: '6acb4d37f6cae125e60d8238',
        bookingId: '6acb4d37f6cae125e60d8238',
        renter: {
          id: 'hao_xiaomi_rej',
          name: 'Đỗ Nguyên Hạo',
          avatar: 'https://res.cloudinary.com/oigtlazh/image/upload/v1789998671/techshare/avatars/fj73qabjynrykcqqfehq.jpg',
          isVerified: true,
        },
        device: {
          id: 'dev_xiaomi',
          name: 'Xiaomi 14T Pro 512GB',
          image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=900&q=80',
        },
        status: 'rejected',
        statusLabel: 'REJECTED',
        statusType: 'rejected',
        dateFormatted: '11/10',
        lastMessage: OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET,
      },
      {
        id: '6acb4d91f6cae125e60d82c0',
        bookingId: '6acb4d91f6cae125e60d82c0',
        renter: {
          id: 'hao_xiaomi_appr',
          name: 'Đỗ Nguyên Hạo',
          avatar: 'https://res.cloudinary.com/oigtlazh/image/upload/v1789998671/techshare/avatars/fj73qabjynrykcqqfehq.jpg',
          isVerified: true,
        },
        device: {
          id: 'dev_xiaomi_appr',
          name: 'Xiaomi 14T Pro 512GB',
          image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=900&q=80',
        },
        status: 'approved',
        statusLabel: 'ĐÃ DUYỆT',
        statusType: 'approved',
        dateFormatted: '11/10',
        lastMessage: OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET,
      },
      {
        id: '6acb40f5b3b74dbc4617a0cf',
        bookingId: '6acb40f5b3b74dbc4617a0cf',
        renter: {
          id: 'cust_canon2',
          name: 'Customer',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
          isVerified: false,
        },
        device: {
          id: 'dev_canon2',
          name: 'Canon PowerShot G7 X Mark III',
          image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
        },
        status: 'pending',
        statusLabel: 'Pending',
        statusType: 'pending',
        dateFormatted: '11/10',
        lastMessage: OWNER_STRINGS.MESSAGES.FALLBACK_SNIPPET,
      },
    ],
    []
  );

  // Tải danh sách Customer Messages trực tiếp từ MongoDB Atlas
  const fetchMessages = useCallback(async () => {
    try {
      const endpoints = [
        'http://192.168.1.36:5000/api/owner/messages',
        'http://10.0.2.2:5000/api/owner/messages',
        'http://localhost:5000/api/owner/messages',
      ];

      let jsonResult: any = null;
      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            jsonResult = await response.json();
            break;
          }
        } catch {
          // Thử endpoint tiếp theo
        }
      }

      if (jsonResult && jsonResult.success && Array.isArray(jsonResult.data)) {
        setConversations(jsonResult.data);
      } else {
        setConversations(fallbackConversations);
      }
    } catch {
      setConversations(fallbackConversations);
    }
  }, [fallbackConversations]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  // Lọc danh sách theo Tab và Từ khóa tìm kiếm
  const filteredConversations = useMemo(() => {
    return conversations.filter((item) => {
      // 1. Lọc theo tab trạng thái
      if (activeTab === 'renting') {
        if (item.status !== 'active' && item.status !== 'approved') return false;
      } else if (activeTab === 'pending') {
        if (item.status !== 'pending') return false;
      } else if (activeTab === 'completed') {
        if (item.status !== 'completed') return false;
      }

      // 2. Lọc theo ô tìm kiếm renter hoặc tên thiết bị
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchRenter = item.renter.name.toLowerCase().includes(query);
        const matchDevice = item.device.name.toLowerCase().includes(query);
        if (!matchRenter && !matchDevice) return false;
      }

      return true;
    });
  }, [conversations, activeTab, searchQuery]);

  const handleOpenConversation = (item: ConversationItem) => {
    if (navigation?.navigate) {
      navigation.navigate('ChatDetail', {
        bookingId: item.bookingId,
      });
    }
  };

  // Helper render badge trạng thái
  const renderStatusBadge = (item: ConversationItem) => {
    let badgeStyle = styles.badgeCompleted;
    let textStyle = styles.badgeTextCompleted;

    if (item.statusType === 'pending') {
      badgeStyle = styles.badgePending;
      textStyle = styles.badgeTextPending;
    } else if (item.statusType === 'rejected') {
      badgeStyle = styles.badgeRejected;
      textStyle = styles.badgeTextRejected;
    } else if (item.statusType === 'approved') {
      badgeStyle = styles.badgeApproved;
      textStyle = styles.badgeTextApproved;
    } else if (item.statusType === 'active') {
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

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => handleOpenConversation(item)}
        activeOpacity={0.7}
      >
        {/* Avatar bên trái kèm badge thumbnail thiết bị nhỏ ở góc dưới */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.renter.avatar }} style={styles.renterAvatar} />
          <View style={styles.deviceMiniThumbnailContainer}>
            <Image source={{ uri: item.device.image }} style={styles.deviceMiniThumbnail} />
          </View>
        </View>

        {/* Nội dung tin nhắn & thông tin chi tiết */}
        <View style={styles.cardContent}>
          {/* Hàng 1: Tên người thuê + Huy hiệu xác thực + Thời gian */}
          <View style={styles.topRow}>
            <View style={styles.nameRow}>
              <Text style={styles.renterNameText} numberOfLines={1}>
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
            <Text style={styles.dateText}>{item.dateFormatted}</Text>
          </View>

          {/* Hàng 2: Icon chip + Tên thiết bị + Badge trạng thái đơn */}
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
            </View>
            {renderStatusBadge(item)}
          </View>

          {/* Hàng 3: Snippet tin nhắn gần nhất */}
          <Text
            style={[
              styles.lastMessageText,
              hasActiveMessage ? styles.lastMessageActive : styles.lastMessageMuted,
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
    <View style={[styles.screenContainer, { paddingTop: statusBarOffset }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
        translucent={true}
      />

      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.openDrawer?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{OWNER_STRINGS.MESSAGES.HEADER_TITLE}</Text>
          <Text style={styles.headerSubtitle}>{OWNER_STRINGS.MESSAGES.HEADER_SUBTITLE}</Text>
        </View>
      </View>

      {/* 2. Thanh tìm kiếm (Search Bar) */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={OWNER_STRINGS.MESSAGES.SEARCH_PLACEHOLDER}
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
            {OWNER_STRINGS.MESSAGES.TABS.ALL_CHATS}
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
            {OWNER_STRINGS.MESSAGES.TABS.RENTING}
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
            {OWNER_STRINGS.MESSAGES.TABS.PENDING}
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
            {OWNER_STRINGS.MESSAGES.TABS.COMPLETED}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Danh sách các cuộc trò chuyện (Conversation List) */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
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
              {searchQuery
                ? OWNER_STRINGS.MESSAGES.EMPTY_SEARCH
                : OWNER_STRINGS.MESSAGES.EMPTY_LIST}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 20,
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
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    height: 48,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 12,
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#0D9488', // Teal xanh đặc trưng
  },
  filterTabText: {
    fontSize: 13,
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
    paddingBottom: 32,
  },
  conversationCard: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: theme.colors.surface,
  },
  avatarContainer: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  renterAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceMuted,
  },
  deviceMiniThumbnailContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  deviceMiniThumbnail: {
    width: '100%',
    height: '100%',
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
  verifiedIcon: {
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: theme.typography.fontWeight.medium,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.muted,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default OwnerMessagesScreen;
