import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';
import { BookingItemCard } from '../../components/booking/BookingItemCard';
import { ExtensionModal } from '../../components/booking/ExtensionModal';
import { ReviewModal } from '../../components/booking/ReviewModal';
import { BookingCancelModal } from '../../components/booking/BookingCancelModal';
import BookingResultModal from './components/BookingResultModal';
import { bookingService, Booking } from '../../services/bookingService';
import { useAppSelector } from '../../store';

export interface MyBookingsScreenProps {
  onNavigateToBookingDetail?: (bookingId: string) => void;
  onNavigateToDeviceDetail?: (deviceId: string) => void;
  onNavigateToBookingCreate?: (deviceId: string) => void;
  onNavigateToHome?: () => void;
  onNavigateToLogin?: () => void;
  navigation?: any;
}

type TabType = 'all' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';

const TABS: { id: TabType; label: string; status: string }[] = [
  { id: 'all', label: 'All', status: '' },
  { id: 'pending', label: 'Pending', status: 'pending' },
  { id: 'approved', label: 'Approved', status: 'approved' },
  { id: 'active', label: 'Active', status: 'active' },
  { id: 'completed', label: 'Completed', status: 'completed' },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' },
];

export function MyBookingsScreen({
  onNavigateToHome,
  onNavigateToBookingDetail,
  onNavigateToDeviceDetail,
  onNavigateToBookingCreate,
  onNavigateToLogin,
  navigation,
}: MyBookingsScreenProps) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState<Booking | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [selectedBookingToExtend, setSelectedBookingToExtend] = useState<Booking | null>(null);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBookingToReview, setSelectedBookingToReview] = useState<Booking | null>(null);

  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: 'error' | 'warning' | 'success';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  const openExtendModal = (booking: Booking) => {
    setSelectedBookingToExtend(booking);
    setExtensionModalVisible(true);
  };

  const openReviewModal = (booking: Booking) => {
    setSelectedBookingToReview(booking);
    setReviewModalVisible(true);
  };

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bookingService.getMyBookings('');
      setAllBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Error loading bookings list:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchBookings();
      }
    }, [fetchBookings, isAuthenticated])
  );

  const onRefresh = async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const handlePressBooking = (booking: Booking) => {
    if (onNavigateToBookingDetail) {
      onNavigateToBookingDetail(booking._id);
    } else if (navigation?.navigate) {
      navigation.navigate('BookingDetail', { bookingId: booking._id });
    } else if (onNavigateToDeviceDetail && booking.deviceId?._id) {
      onNavigateToDeviceDetail(booking.deviceId._id);
    }
  };

  const handleChat = (booking: Booking) => {
    if (navigation?.navigate) {
      navigation.navigate('ChatDetail', { bookingId: booking._id });
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
      fetchBookings();
    } catch (error: any) {
      setResultModal({
        visible: true,
        type: 'error',
        title: STRINGS.BOOKING_DETAIL.ALERT_ERROR_TITLE,
        message: error.response?.data?.message || STRINGS.BOOKING_DETAIL.CANCEL_ERROR,
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Filter list simply by active tab
  const filteredBookings = useMemo(() => {
    if (activeTab === 'pending') {
      return allBookings.filter((b) => b.status === 'pending');
    }
    if (activeTab === 'approved') {
      return allBookings.filter((b) => b.status === 'approved');
    }
    if (activeTab === 'active') {
      return allBookings.filter((b) => b.status === 'active');
    }
    if (activeTab === 'completed') {
      return allBookings.filter((b) => b.status === 'completed');
    }
    if (activeTab === 'cancelled') {
      return allBookings.filter((b) => b.status === 'cancelled' || b.status === 'rejected');
    }
    return allBookings;
  }, [allBookings, activeTab]);

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="receipt-outline" size={36} color={theme.colors.brand[500]} />
        </View>
        <Text style={styles.emptyTitle}>{STRINGS.MY_BOOKINGS.EMPTY_TITLE}</Text>
        <Text style={styles.emptySubtitle}>{STRINGS.MY_BOOKINGS.EMPTY_DESC}</Text>
        {onNavigateToHome && activeTab === 'all' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNavigateToHome}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={15} color={theme.colors.white} />
            <Text style={styles.actionButtonText}>{STRINGS.MY_BOOKINGS.EXPLORE_DEVICES}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => {
              if (navigation?.canGoBack?.()) navigation.goBack();
              else if (onNavigateToHome) onNavigateToHome();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{STRINGS.MY_BOOKINGS.TITLE}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={36} color={theme.colors.brand[500]} />
          </View>
          <Text style={styles.emptyTitle}>{STRINGS.MY_BOOKINGS.GUEST_TITLE}</Text>
          <Text style={styles.emptySubtitle}>{STRINGS.MY_BOOKINGS.GUEST_SUBTITLE}</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (onNavigateToLogin) {
                onNavigateToLogin();
              } else if (navigation?.navigate) {
                navigation.navigate('Login');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={16} color={theme.colors.white} />
            <Text style={styles.actionButtonText}>
              {STRINGS.MY_BOOKINGS.GUEST_LOGIN_BUTTON}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* 1. Clean Header (No subtitle, no bell clutter) */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerIconButton}
          onPress={() => {
            if (navigation?.openDrawer) {
              navigation.openDrawer();
            } else if (navigation?.canGoBack?.()) {
              navigation.goBack();
            } else if (onNavigateToHome) {
              onNavigateToHome();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={navigation?.openDrawer ? 'menu-outline' : 'chevron-back'}
            size={22}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{STRINGS.MY_BOOKINGS.TITLE}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 2. Simplified Clean Tabs (No counter bubbles cluttering the pills) */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isTabActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabButtonText, isTabActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Bookings List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item: Booking) => item._id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Booking }) => (
            <BookingItemCard
              booking={item}
              onPress={() => handlePressBooking(item)}
              onCancel={() => openCancelModal(item)}
              onExtend={() => openExtendModal(item)}
              onReview={() => openReviewModal(item)}
              onReRent={() => handleReRent(item)}
              onChat={() => handleChat(item)}
            />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.brand[500]]}
            />
          }
        />
      )}

      {/* EXTENSION MODAL */}
      <ExtensionModal
        visible={extensionModalVisible}
        booking={selectedBookingToExtend}
        onClose={() => setExtensionModalVisible(false)}
        onSuccess={() => fetchBookings()}
      />

      {/* REVIEW MODAL */}
      <ReviewModal
        visible={reviewModalVisible}
        booking={selectedBookingToReview}
        onClose={() => setReviewModalVisible(false)}
        onSuccess={() => {
          if (selectedBookingToReview) {
            setAllBookings((prev) =>
              prev.map((b) =>
                b._id === selectedBookingToReview._id ? { ...b, isReviewed: true } : b
              )
            );
          }
          fetchBookings();
        }}
      />

      {/* CANCEL MODAL */}
      <BookingCancelModal
        visible={cancelModalVisible}
        bookingCode={selectedBookingToCancel?.bookingCode}
        isCancelling={isSubmittingCancel}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleConfirmCancel}
      />

      {/* UNIFIED RESULT / ERROR MODAL */}
      <BookingResultModal
        visible={resultModal.visible}
        type={resultModal.type || 'error'}
        title={resultModal.title}
        message={resultModal.message}
        onClose={() => setResultModal({ ...resultModal, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  tabsWrapper: {
    backgroundColor: theme.colors.surface,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.divider,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.brand[600],
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  tabButtonTextActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.brand[600],
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 14,
  },
  actionButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
