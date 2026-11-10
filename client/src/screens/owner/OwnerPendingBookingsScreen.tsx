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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { OwnerApprovalCard } from '../../components/booking/OwnerApprovalCard';
import { ReviewModal } from '../../components/booking/ReviewModal';
import { HandoverCameraModal } from '../../components/booking/HandoverCameraModal';
import { HandoverScannerModal } from '../../components/booking/HandoverScannerModal';
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
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id;

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [scanBooking, setScanBooking] = useState<Booking | null>(null);
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

  // Fetch bookings for owner from API
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
      console.warn('[OwnerPendingBookingsScreen] Error loading bookings:', error);
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

  // Approve booking request
  const handleApprove = async (booking: Booking) => {
    try {
      setProcessingId(booking._id);
      await bookingService.updateBookingStatusByOwner(booking._id, 'approved');
      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Unable to approve booking. Please retry.';
      Alert.alert('Approval Failed', msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Open decline modal
  const handleOpenReject = (booking: Booking) => {
    setSelectedBookingForReject(booking);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  // Confirm decline booking request
  const handleConfirmReject = async () => {
    if (!selectedBookingForReject) return;
    try {
      const reasonToSubmit =
        rejectReason.trim() || 'Owner is unavailable during this time';
      setProcessingId(selectedBookingForReject._id);
      setRejectModalVisible(false);

      await bookingService.updateBookingStatusByOwner(
        selectedBookingForReject._id,
        'rejected',
        reasonToSubmit
      );

      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Unable to decline booking. Please retry.';
      Alert.alert('Decline Failed', msg);
    } finally {
      setProcessingId(null);
      setSelectedBookingForReject(null);
    }
  };

  // Open chat with renter
  const handleChat = (booking: Booking) => {
    if (!navigation) return;
    navigation.navigate('ChatDetail', { bookingId: booking._id });
  };

  // Handover device (approved -> active)
  const handleHandover = (booking: Booking) => setScanBooking(booking);

  // Complete rental (active -> completed)
  const handleComplete = async (booking: Booking) => {
    try {
      setProcessingId(booking._id);
      await bookingService.updateBookingStatusByOwner(booking._id, 'completed');
      await fetchBookings();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Unable to complete rental. Please retry.';
      Alert.alert('Completion Failed', msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Open renter review modal
  const handleOpenReviewRenter = (booking: Booking) => {
    setSelectedBookingForReview(booking);
    setReviewModalVisible(true);
  };

  // Open return inspection camera modal
  const handleOpenReturnCamera = (booking: Booking) => {
    if (booking.status !== 'active') return;
    setSelectedBookingForCamera(booking);
    setReturnCameraModalVisible(true);
  };

  // Filter bookings by active tab and search query
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
      const deviceName = (b.deviceId?.name || b.deviceId?.title || '').toLowerCase();
      const code = (b.bookingCode || b._id || '').toLowerCase();
      return renterName.includes(query) || deviceName.includes(query) || code.includes(query);
    });
  };

  const filteredList = getFilteredBookings();

  // Tab counters
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
    { key: 'all', label: 'All', count: allCount },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved', count: approvedCount },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'completed', label: 'Completed', count: completedCount },
    { key: 'cancelled', label: 'Cancelled', count: cancelledCount },
  ];

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 16
  );

  const handleMenuPress = () => {
    if (navigation?.openDrawer) {
      navigation.openDrawer();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const leftIconName = navigation?.openDrawer ? 'menu-outline' : 'chevron-back';

  const declineReasons = [
    'Device is under maintenance / inspection',
    'Owner has an unexpected schedule conflict',
    'Delivery / pickup location is too far',
    'Device was already reserved for another rental',
  ];

  return (
    <View style={[styles.screenContainer, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.background} />

      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={navigation?.openDrawer ? 'Open Navigation Menu' : 'Go Back'}
          style={styles.headerIconButton}
          onPress={handleMenuPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={leftIconName} size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Rental Requests</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Review, handover and manage customer bookings
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.navigate?.('OwnerNotifications')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="View Notifications"
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.light.textPrimary} />
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
          <Ionicons name="search-outline" size={18} color={colors.light.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer, device or booking code"
            placeholderTextColor={colors.light.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={colors.light.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Status Filter Tabs */}
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
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: isTabActive }}
                accessibilityLabel={`${tab.label} filter tab, ${tab.count} items`}
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

      {/* 4. Booking List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.loadingText}>Loading rental requests...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 20, 28) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.light.primary]}
              tintColor={colors.light.primary}
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
              isProcessing={!!processingId || !!scanBooking}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="file-tray-outline" size={38} color={colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>No rental requests found</Text>
              <Text style={styles.emptySubtitle}>
                When customers submit new rental requests or bookings reach this status, they
                will appear here immediately.
              </Text>
              <TouchableOpacity
                style={styles.reloadButton}
                onPress={onRefresh}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Refresh rental requests list"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.light.primaryDark} />
                <Text style={styles.reloadButtonText}>Refresh List</Text>
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
                <Ionicons name="alert-circle-outline" size={22} color={colors.light.error} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Decline Rental Request</Text>
                <Text style={styles.modalSubtitle}>
                  #{selectedBookingForReject?.bookingCode || selectedBookingForReject?._id?.slice(-8).toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.modalPromptText}>
              Please select or enter a reason for declining this rental request:
            </Text>

            {/* Quick Reason Chips */}
            <View style={styles.chipsContainer}>
              {declineReasons.map((r, idx) => (
                <TouchableOpacity
                  key={`reason-${idx}`}
                  style={[styles.reasonChip, rejectReason === r && styles.reasonChipSelected]}
                  onPress={() => setRejectReason(r)}
                  activeOpacity={0.75}
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
              placeholder="Enter specific reason for declining..."
              placeholderTextColor={colors.light.textMuted}
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
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmRejectButton}
                onPress={handleConfirmReject}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle" size={16} color={colors.light.white} />
                <Text style={styles.modalConfirmRejectText}>Confirm Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Renter Review Modal */}
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

      {/* 7. Owner Handover QR Scanner Modal */}
      {scanBooking && (
        <HandoverScannerModal
          bookingId={scanBooking._id}
          onClose={() => setScanBooking(null)}
          onSuccess={(updated) => {
            setAllBookings((items) =>
              items.map((item) => (item._id === updated._id ? updated : item))
            );
            setScanBooking(null);
            fetchBookings();
          }}
        />
      )}

      {/* 8. Owner Return Inspection Camera Modal */}
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
    backgroundColor: colors.light.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.light.background,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.light.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.light.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.light.white,
  },
  notifBadgeText: {
    color: colors.light.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 2,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.card,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13.5,
    color: colors.light.textPrimary,
    paddingVertical: 0,
  },
  tabsWrapper: {
    marginBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.light.borderSubtle,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.light.white,
    fontWeight: '700',
  },
  badgeCounter: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeCounterActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeCounterInactive: {
    backgroundColor: colors.light.borderDefault,
  },
  badgeCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  badgeCounterTextActive: {
    color: colors.light.white,
  },
  listContent: {
    paddingHorizontal: 20,
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
    fontSize: 13.5,
    color: colors.light.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
    gap: 6,
  },
  reloadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.light.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalWarningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  modalPromptText: {
    fontSize: 13,
    color: colors.light.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
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
    borderRadius: 8,
    backgroundColor: colors.light.borderSubtle,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  reasonChipSelected: {
    backgroundColor: colors.light.dangerLight,
    borderColor: colors.light.error,
  },
  reasonChipText: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  reasonChipTextSelected: {
    color: colors.light.error,
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: colors.light.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.light.textPrimary,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
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
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.light.borderSubtle,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  modalConfirmRejectButton: {
    flex: 1.4,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmRejectText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.white,
  },
});

export default OwnerPendingBookingsScreen;
