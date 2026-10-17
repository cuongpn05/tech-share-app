import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { BookingItemCard } from '../../components/booking/BookingItemCard';
import { ExtensionModal } from '../../components/booking/ExtensionModal';
import { ReviewModal } from '../../components/booking/ReviewModal';
import { BookingCancelModal } from '../../components/booking/BookingCancelModal';
import { bookingService, Booking } from '../../services/bookingService';

export interface MyBookingsScreenProps {
  onNavigateToBookingDetail?: (bookingId: string) => void;
  onNavigateToDeviceDetail?: (deviceId: string) => void;
  onNavigateToBookingCreate?: (deviceId: string) => void;
  onNavigateToHome?: () => void;
}

const TABS = [
  { id: 'all', label: STRINGS.MY_BOOKINGS.TABS.ALL, status: '' },
  { id: 'pending', label: STRINGS.MY_BOOKINGS.TABS.PENDING, status: 'pending' },
  { id: 'approved', label: STRINGS.MY_BOOKINGS.TABS.APPROVED, status: 'approved' },
  { id: 'active', label: STRINGS.MY_BOOKINGS.TABS.ACTIVE, status: 'active' },
  { id: 'completed', label: STRINGS.MY_BOOKINGS.TABS.COMPLETED, status: 'completed' },
  { id: 'cancelled', label: STRINGS.MY_BOOKINGS.TABS.CANCELLED, status: 'cancelled' },
];

export function MyBookingsScreen({
  onNavigateToHome,
  onNavigateToBookingDetail,
  onNavigateToDeviceDetail,
  onNavigateToBookingCreate,
}: MyBookingsScreenProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const [activeTab, setActiveTab] = useState('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState<Booking | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [selectedBookingToExtend, setSelectedBookingToExtend] = useState<Booking | null>(null);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBookingToReview, setSelectedBookingToReview] = useState<Booking | null>(null);

  const openExtendModal = (booking: Booking) => {
    setSelectedBookingToExtend(booking);
    setExtensionModalVisible(true);
  };

  const openReviewModal = (booking: Booking) => {
    setSelectedBookingToReview(booking);
    setReviewModalVisible(true);
  };

  const fetchBookings = useCallback(async (tabId: string) => {
    try {
      setLoading(true);
      const tab = TABS.find((t) => t.id === tabId);
      const status = tab?.status || '';
      const data = await bookingService.getMyBookings(status);
      setBookings(data || []);
    } catch (error) {
      console.warn('Error loading bookings list:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings(activeTab);
    }, [activeTab, fetchBookings])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings(activeTab);
    setRefreshing(false);
  };

  const handlePressBooking = (booking: Booking) => {
    if (onNavigateToBookingDetail) {
      onNavigateToBookingDetail(booking._id);
    } else if (onNavigateToDeviceDetail && booking.deviceId?._id) {
      onNavigateToDeviceDetail(booking.deviceId._id);
    }
  };

  const handleReRent = (booking: Booking) => {
    const deviceId =
      booking.deviceId?._id ||
      (typeof booking.deviceId === 'string' ? booking.deviceId : null);
    if (!deviceId) return;
    if (onNavigateToBookingCreate) {
      onNavigateToBookingCreate(deviceId);
    } else if (onNavigateToDeviceDetail) {
      onNavigateToDeviceDetail(deviceId);
    }
  };

  const openCancelModal = (booking: Booking) => {
    setSelectedBookingToCancel(booking);
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBookingToCancel) return;
    try {
      setIsSubmittingCancel(true);
      await bookingService.cancelBooking(
        selectedBookingToCancel._id,
        STRINGS.BOOKING_DETAIL.CANCEL_REASON_DEFAULT
      );
      setCancelModalVisible(false);
      fetchBookings(activeTab);
    } catch (error: any) {
      Alert.alert(
        STRINGS.BOOKING_DETAIL.ALERT_ERROR_TITLE,
        error.response?.data?.message || STRINGS.BOOKING_DETAIL.CANCEL_ERROR
      );
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="receipt-outline" size={54} color={colors.light.primary} />
        </View>
        <Text style={styles.title}>{STRINGS.MY_BOOKINGS.EMPTY_TITLE}</Text>
        <Text style={styles.description}>
          {STRINGS.MY_BOOKINGS.EMPTY_DESC}
        </Text>
        {onNavigateToHome && activeTab === 'all' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNavigateToHome}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={18} color={colors.light.white} />
            <Text style={styles.actionButtonText}>{STRINGS.MY_BOOKINGS.EXPLORE_DEVICES}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="receipt" size={24} color={colors.light.primary} />
          <Text style={styles.headerTitle}>{STRINGS.MY_BOOKINGS.TITLE}</Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(item.id)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* CONTENT */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item: Booking) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Booking }) => (
            <BookingItemCard
              booking={item}
              onPress={() => handlePressBooking(item)}
              onCancel={() => openCancelModal(item)}
              onExtend={() => openExtendModal(item)}
              onReview={() => openReviewModal(item)}
              onReRent={() => handleReRent(item)}
            />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.light.primary]}
              tintColor={colors.light.primary}
            />
          }
        />
      )}

      {/* EXTENSION MODAL */}
      <ExtensionModal
        visible={extensionModalVisible}
        booking={selectedBookingToExtend}
        onClose={() => setExtensionModalVisible(false)}
        onSuccess={() => fetchBookings(activeTab)}
      />

      {/* REVIEW MODAL */}
      <ReviewModal
        visible={reviewModalVisible}
        booking={selectedBookingToReview}
        onClose={() => setReviewModalVisible(false)}
        onSuccess={() => fetchBookings(activeTab)}
      />

      {/* CANCEL MODAL */}
      <BookingCancelModal
        visible={cancelModalVisible}
        bookingCode={selectedBookingToCancel?.bookingCode}
        isCancelling={isSubmittingCancel}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleConfirmCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.light.surface,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  tabsContainer: {
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.light.background,
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.light.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  tabTextActive: {
    color: colors.light.white,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  description: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 12,
  },
  actionButtonText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
