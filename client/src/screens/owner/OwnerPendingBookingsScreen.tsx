import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { OwnerApprovalCard } from '../../components/booking/OwnerApprovalCard';
import { ReviewModal } from '../../components/booking/ReviewModal';
import { HandoverCameraModal } from '../../components/booking/HandoverCameraModal';
import { bookingService, Booking } from '../../services/bookingService';
import { notificationService } from '../../services/notificationService';
import { useAppSelector } from '../../store';

export interface OwnerPendingBookingsScreenProps {
  navigation?: any;
}

type TabType = 'all' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';

export const OwnerPendingBookingsScreen: React.FC<OwnerPendingBookingsScreenProps> = ({
  navigation,
}) => {
  const strings = OWNER_STRINGS.PENDING_REQUESTS;
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id;

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedBookingForReject, setSelectedBookingForReject] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Renter Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);

  // Owner Return Camera Modal State (ONLY when booking is active)
  const [returnCameraModalVisible, setReturnCameraModalVisible] = useState(false);
  const [selectedBookingForCamera, setSelectedBookingForCamera] = useState<Booking | null>(null);

  const [unreadNotifications, setUnreadNotifications] = useState(
    notificationService.getUnreadCountCached()
  );

  // Tải danh sách đơn thuê từ Database Atlas dựa chính xác vào Owner
  const fetchBookings = useCallback(async () => {
    try {
      const [allData, pendingData] = await Promise.all([
        bookingService.getOwnerBookings('all', currentUserId),
        bookingService.getOwnerPendingBookings(currentUserId),
      ]);

      const normalizedAll = Array.isArray(allData) ? allData : [];
      const normalizedPending =
        Array.isArray(pendingData) && pendingData.length > 0
          ? pendingData
          : normalizedAll.filter((b) => b.status === 'pending');

      setAllBookings(normalizedAll);
      setPendingBookings(normalizedPending);
    } catch (error) {
      console.warn('[OwnerPendingBookingsScreen] Lỗi khi tải dữ liệu từ server:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchBookings();
    if (currentUserId) {
      notificationService.fetchUnreadCount(currentUserId);
    }
    const unsubNotif = notificationService.onUnreadCountChange((count) => {
      setUnreadNotifications(count);
    });
    const unsubBookings = bookingService.onBookingsUpdated(() => {
      fetchBookings();
    });
    return () => {
      unsubNotif();
      unsubBookings();
    };
  }, [fetchBookings, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
      if (currentUserId) {
        notificationService.fetchUnreadCount(currentUserId);
      }
    }, [fetchBookings, currentUserId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  // Approve booking request immediately without confirmation popup
  const handleApprove = async (booking: Booking) => {
    try {
      setProcessingId(booking._id);
      await bookingService.updateBookingStatusByOwner(booking._id, 'approved');
      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || strings.OPERATION_FAILED;
      Alert.alert(strings.ERROR_TITLE, msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Open decline modal (ONLY action that asks for confirmation & reason)
  const handleOpenReject = (booking: Booking) => {
    setSelectedBookingForReject(booking);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  // Confirm decline booking request
  const handleConfirmReject = async () => {
    if (!selectedBookingForReject) return;
    try {
      const reasonToSubmit = rejectReason.trim() || strings.DEFAULT_REJECT_REASON;
      setProcessingId(selectedBookingForReject._id);
      setRejectModalVisible(false);

      await bookingService.updateBookingStatusByOwner(
        selectedBookingForReject._id,
        'rejected',
        reasonToSubmit
      );

      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || strings.OPERATION_FAILED;
      Alert.alert(strings.ERROR_TITLE, msg);
    } finally {
      setProcessingId(null);
      setSelectedBookingForReject(null);
    }
  };

  // Open chat with renter
  const handleChat = (booking: Booking) => {
    if (!navigation) return;
    navigation.navigate('ChatDetail', {
      bookingId: booking._id,
      otherBookings: [booking],
    });
  };

  // Handover device immediately without confirmation popup (approved -> active)
  const handleHandover = async (booking: Booking) => {
    try {
      setProcessingId(booking._id);
      await bookingService.updateBookingStatusByOwner(booking._id, 'active');
      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || strings.OPERATION_FAILED;
      Alert.alert(strings.ERROR_TITLE, msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Receive device & complete rental immediately without confirmation popup (active -> completed)
  const handleComplete = async (booking: Booking) => {
    try {
      setProcessingId(booking._id);
      await bookingService.updateBookingStatusByOwner(booking._id, 'completed');
      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || strings.OPERATION_FAILED;
      Alert.alert(strings.ERROR_TITLE, msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Mở modal đánh giá khách thuê khi đơn hàng đã completed
  const handleOpenReviewRenter = (booking: Booking) => {
    setSelectedBookingForReview(booking);
    setReviewModalVisible(true);
  };

  // Mở modal chụp ảnh kiểm tra máy khi trả (chỉ khi đơn hàng đang active)
  const handleOpenReturnCamera = (booking: Booking) => {
    if (booking.status !== 'active') return;
    setSelectedBookingForCamera(booking);
    setReturnCameraModalVisible(true);
  };

  // Lọc danh sách theo tab và thanh tìm kiếm
  const getFilteredBookings = () => {
    let sourceList: Booking[] = [];
    if (activeTab === 'pending') {
      sourceList =
        pendingBookings.length > 0
          ? pendingBookings
          : allBookings.filter((b) => b.status === 'pending');
    } else if (activeTab === 'approved') {
      sourceList = allBookings.filter((b) => b.status === 'approved');
    } else if (activeTab === 'active') {
      sourceList = allBookings.filter((b) => b.status === 'active');
    } else if (activeTab === 'completed') {
      sourceList = allBookings.filter((b) => b.status === 'completed');
    } else if (activeTab === 'cancelled') {
      sourceList = allBookings.filter(
        (b) => b.status === 'cancelled' || b.status === 'rejected'
      );
    } else {
      sourceList = allBookings;
    }

    if (!searchQuery.trim()) {
      return sourceList;
    }

    const query = searchQuery.trim().toLowerCase();
    return sourceList.filter((b) => {
      const renterName = (b.renterId?.name || b.renterId?.username || '').toLowerCase();
      const deviceName = (b.deviceId?.name || '').toLowerCase();
      const code = (b.bookingCode || '').toLowerCase();
      return renterName.includes(query) || deviceName.includes(query) || code.includes(query);
    });
  };

  const filteredList = getFilteredBookings();
  const pendingCount =
    pendingBookings.length || allBookings.filter((b) => b.status === 'pending').length;
  const approvedCount = allBookings.filter((b) => b.status === 'approved').length;
  const activeCount = allBookings.filter((b) => b.status === 'active').length;
  const completedCount = allBookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = allBookings.filter(
    (b) => b.status === 'cancelled' || b.status === 'rejected'
  ).length;
  const allCount = allBookings.length;

  const tabItems: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: strings.TABS.ALL, count: allCount },
    { key: 'pending', label: strings.TABS.PENDING, count: pendingCount },
    { key: 'approved', label: strings.TABS.APPROVED, count: approvedCount },
    { key: 'active', label: strings.TABS.ACTIVE, count: activeCount },
    { key: 'completed', label: strings.TABS.COMPLETED, count: completedCount },
    { key: 'cancelled', label: strings.TABS.CANCELLED, count: cancelledCount },
  ];

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

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
          onPress={() => navigation?.openDrawer?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{strings.HEADER_TITLE}</Text>
          <Text style={styles.headerSubtitle}>{strings.HEADER_SUBTITLE}</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.navigate?.('OwnerNotifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={20} color={theme.colors.text.primary} />
          {unreadNotifications > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={strings.SEARCH_PLACEHOLDER}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Segmented Tabs Filter */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabItems.map((tab) => {
            const isTabActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isTabActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabButtonText, isTabActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    style={[
                      styles.badgeCounter,
                      isTabActive ? styles.badgeCounterActive : styles.badgeCounterInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeCounterText,
                        isTabActive && styles.badgeCounterTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Main List of Bookings */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.loadingText}>{strings.LOADING_TEXT}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.brand[500]]}
            />
          }
          renderItem={({ item }) => (
            <OwnerApprovalCard
              booking={item}
              onPress={(selected) =>
                navigation?.navigate('BookingRequestDetail', { bookingId: selected._id })
              }
              onApprove={handleApprove}
              onReject={handleOpenReject}
              onHandover={handleHandover}
              onComplete={handleComplete}
              onTakeReturnPhotos={handleOpenReturnCamera}
              onReviewRenter={handleOpenReviewRenter}
              onChat={handleChat}
              isProcessing={processingId === item._id}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="file-tray-outline" size={42} color={theme.colors.brand[500]} />
              </View>
              <Text style={styles.emptyTitle}>{strings.EMPTY_TITLE}</Text>
              <Text style={styles.emptySubtitle}>{strings.EMPTY_SUBTITLE}</Text>
              <TouchableOpacity style={styles.reloadButton} onPress={onRefresh} activeOpacity={0.8}>
                <Ionicons name="refresh" size={16} color={theme.colors.brand[600]} />
                <Text style={styles.reloadButtonText}>{strings.RELOAD_BUTTON}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* 5. Reject with Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalWarningIcon}>
                <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>{strings.CONFIRM_REJECT_TITLE}</Text>
                <Text style={styles.modalSubtitle}>
                  #{selectedBookingForReject?.bookingCode || ''}
                </Text>
              </View>
            </View>

            <Text style={styles.modalPromptText}>{strings.CONFIRM_REJECT_PROMPT}</Text>

            {/* Quick Reason Chips */}
            <View style={styles.chipsContainer}>
              {strings.REASONS.map((r, idx) => (
                <TouchableOpacity
                  key={`reason-${idx}`}
                  style={[styles.reasonChip, rejectReason === r && styles.reasonChipSelected]}
                  onPress={() => setRejectReason(r)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.reasonChipText,
                      rejectReason === r && styles.reasonChipTextSelected,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input */}
            <TextInput
              style={styles.modalTextInput}
              placeholder={strings.REJECT_REASON_PLACEHOLDER}
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline={true}
              numberOfLines={3}
            />

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{strings.CANCEL}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmRejectButton}
                onPress={handleConfirmReject}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle" size={17} color="#FFFFFF" />
                <Text style={styles.modalConfirmRejectText}>{strings.CONFIRM}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Renter Review Modal (Same mechanism as Renter reviewing Owner) */}
      <ReviewModal
        visible={reviewModalVisible}
        booking={selectedBookingForReview}
        mode="owner_to_renter"
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedBookingForReview(null);
        }}
        onSuccess={() => {
          fetchBookings();
        }}
      />

      {/* 7. Owner Return Inspection Camera Modal (ONLY when booking is active) */}
      <HandoverCameraModal
        visible={returnCameraModalVisible}
        booking={selectedBookingForCamera}
        mode="owner_after"
        onClose={() => {
          setReturnCameraModalVisible(false);
          setSelectedBookingForCamera(null);
        }}
        onSuccess={() => {
          fetchBookings();
        }}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
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
  notifBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    lineHeight: 12,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: 6,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13.5,
    color: theme.colors.text.primary,
  },
  tabsWrapper: {
    marginBottom: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#0D9488',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badgeCounter: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCounterActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeCounterInactive: {
    backgroundColor: '#E2E8F0',
  },
  badgeCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  badgeCounterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.text.muted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 6,
  },
  reloadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.brand[600],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 20,
    ...theme.shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalWarningIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  modalPromptText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
    fontWeight: '500',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonChipSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#475569',
  },
  reasonChipTextSelected: {
    color: '#DC2626',
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlignVertical: 'top',
    height: 75,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalConfirmRejectButton: {
    flex: 1.4,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmRejectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default OwnerPendingBookingsScreen;
