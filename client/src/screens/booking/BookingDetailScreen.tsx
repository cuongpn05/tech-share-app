import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  Pressable,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { bookingService, Booking } from '../../services/bookingService';
import { OrderTimeline } from '../../components/booking/OrderTimeline';
import { RentalCountdownTimer } from '../../components/booking/RentalCountdownTimer';
import { ExtensionModal } from '../../components/booking/ExtensionModal';
import { ReviewModal } from '../../components/booking/ReviewModal';
import { HandoverQrModal } from '../../components/booking/HandoverQrModal';
import { HandoverCameraModal } from '../../components/booking/HandoverCameraModal';
import { BookingCancelModal } from '../../components/booking/BookingCancelModal';
import { reviewService, ReviewItem } from '../../services/reviewService';
import { useAppSelector } from '../../store';
import { navigate } from '../../navigation/navigationRef';

export interface BookingDetailScreenProps {
  bookingId: string;
  onBack: () => void;
  onNavigateToChat?: (bookingId: string) => void;
  onNavigateToBookingCreate?: (deviceId: string) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: {
    label: STRINGS.BOOKING_DETAIL.STATUS.pending,
    color: colors.light.warning,
    icon: 'time-outline',
  },
  approved: {
    label: STRINGS.BOOKING_DETAIL.STATUS.approved,
    color: colors.light.primary,
    icon: 'checkmark-circle-outline',
  },
  active: {
    label: STRINGS.BOOKING_DETAIL.STATUS.active,
    color: colors.light.primary,
    icon: 'play-circle-outline',
  },
  completed: {
    label: STRINGS.BOOKING_DETAIL.STATUS.completed,
    color: colors.light.success,
    icon: 'checkmark-done-circle-outline',
  },
  cancelled: {
    label: STRINGS.BOOKING_DETAIL.STATUS.cancelled,
    color: colors.light.error,
    icon: 'close-circle-outline',
  },
  rejected: {
    label: STRINGS.BOOKING_DETAIL.STATUS.rejected,
    color: colors.light.error,
    icon: 'close-circle-outline',
  },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: {
    label: STRINGS.BOOKING_DETAIL.PAYMENT_STATUS_LABELS.unpaid,
    color: colors.light.warning,
  },
  deposit_held: {
    label: STRINGS.BOOKING_DETAIL.PAYMENT_STATUS_LABELS.deposit_held,
    color: colors.light.primary,
  },
  paid: {
    label: STRINGS.BOOKING_DETAIL.PAYMENT_STATUS_LABELS.paid,
    color: colors.light.success,
  },
  refunded: {
    label: STRINGS.BOOKING_DETAIL.PAYMENT_STATUS_LABELS.refunded,
    color: colors.light.textSecondary,
  },
  disputed: {
    label: STRINGS.BOOKING_DETAIL.PAYMENT_STATUS_LABELS.disputed,
    color: colors.light.error,
  },
};

function calculateDurationBetweenDates(
  startDate?: string | Date,
  endDate?: string | Date,
  fallbackDays?: number
) {
  if (!startDate || !endDate) {
    const days = fallbackDays || 0;
    return {
      totalHours: 0,
      days,
      hours: 0,
      formattedLabel: `${days} ${STRINGS.BOOKING_DETAIL.DAY_UNIT(days)}`,
      hoursBadge: '',
    };
  }
  const diffMs = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
  const totalHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  let formattedLabel = '';
  if (days > 0 && hours > 0) {
    formattedLabel = `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'} (${totalHours}h)`;
  } else if (days > 0) {
    formattedLabel = `${days} ${days === 1 ? 'day' : 'days'} (${totalHours}h)`;
  } else {
    formattedLabel = `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'}`;
  }

  const hoursBadge = `${totalHours}h`;

  return { totalHours, days, hours, formattedLabel, hoursBadge };
}

function formatScheduleDateTime(d?: string | Date) {
  if (!d) return { dateStr: '--', timeStr: '--', weekdayStr: '--' };
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) {
    return { dateStr: '--', timeStr: '--', weekdayStr: '--' };
  }
  const dateStr = dateObj.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const weekdayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  return { dateStr, timeStr, weekdayStr };
}

export function BookingDetailScreen({
  bookingId,
  onBack,
  onNavigateToChat,
  onNavigateToBookingCreate,
}: BookingDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 24 : 16
  );

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = useAppSelector((state) => state.auth.user);
  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [bookingReview, setBookingReview] = useState<ReviewItem | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [handoverCameraModalVisible, setHandoverCameraModalVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const data = await bookingService.getBookingById(bookingId);
      setBooking(data);

      if (data && (data.status === 'completed' || data.isReviewed)) {
        try {
          const rev = await reviewService.getBookingReview(bookingId);
          setBookingReview(rev);
        } catch {
          setBookingReview(null);
        }
      }
    } catch (error: any) {
      console.error('Failed to load booking details:', error);
      Alert.alert(
        STRINGS.BOOKING_DETAIL.ALERT_ERROR_TITLE,
        STRINGS.BOOKING_DETAIL.LOAD_ERROR_MSG
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetail();
    setRefreshing(false);
  };

  const handleChatWithOwner = () => {
    if (!booking) return;
    if (onNavigateToChat) {
      onNavigateToChat(booking._id);
    } else {
      navigate('ChatDetail', { bookingId: booking._id });
    }
  };

  const handleCancelBooking = () => {
    setCancelModalVisible(true);
  };

  const executeCancelBooking = async () => {
    if (!booking) return;
    try {
      setIsCancelling(true);
      await bookingService.cancelBooking(
        booking._id,
        STRINGS.BOOKING_DETAIL.CANCEL_REASON_DEFAULT
      );
      setCancelModalVisible(false);
      fetchDetail();
    } catch (err: any) {
      Alert.alert(
        STRINGS.BOOKING_DETAIL.ALERT_ERROR_TITLE,
        err.response?.data?.message || STRINGS.BOOKING_DETAIL.CANCEL_ERROR
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReRent = () => {
    if (!booking) return;
    const deviceId =
      booking.deviceId?._id ||
      (typeof booking.deviceId === 'string' ? booking.deviceId : null);
    if (!deviceId) return;
    if (onNavigateToBookingCreate) {
      onNavigateToBookingCreate(deviceId);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.light.primary} />
        <Text style={styles.loadingText}>{STRINGS.BOOKING_DETAIL.LOADING}</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={54} color={colors.light.error} />
        <Text style={styles.errorText}>{STRINGS.BOOKING_DETAIL.NOT_FOUND}</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{STRINGS.BOOKING_DETAIL.GO_BACK}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const device = booking.deviceId || {};
  const owner = booking.ownerId || {};
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const paymentConfig =
    PAYMENT_STATUS_CONFIG[booking.paymentStatus] || PAYMENT_STATUS_CONFIG.unpaid;

  const pickupInfo = formatScheduleDateTime(booking.startDate);
  const returnInfo = formatScheduleDateTime(booking.endDate);
  const startDateFormatted = `${pickupInfo.dateStr}, ${pickupInfo.timeStr}`;
  const endDateFormatted = `${returnInfo.dateStr}, ${returnInfo.timeStr}`;

  // Time check: only countdown when booking is active AND current time has reached startDate
  const isActive = booking.status === 'active';

  // Calculate precise rental duration based on hours between pickup and return
  const durationBetweenDates = calculateDurationBetweenDates(
    booking.startDate,
    booking.endDate,
    booking.totalDays
  );

  // Extension status
  const isPendingExtension = booking.extensionRequest?.status === 'pending';
  const isApprovedExtension = booking.extensionRequest?.status === 'approved';

  // Retrieve handover photos and condition notes (supports both virtuals and nested handover)
  const beforePhotos: string[] =
    booking.handoverPhotos?.beforeRental?.length
      ? booking.handoverPhotos.beforeRental
      : (booking as any).handover?.beforePhotos || [];

  const beforeNote: string =
    booking.conditionNotes?.before ||
    (booking as any).handover?.beforeNote ||
    '';

  const showHandoverCard =
    booking.status === 'approved' ||
    booking.status === 'active' ||
    booking.status === 'completed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.surface} />

      {/* ── TOP HEADER ── */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{STRINGS.BOOKING_DETAIL.TITLE}</Text>
          <Text style={styles.headerSubtitle}>#{booking.bookingCode}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '1A' }]}>
          <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.light.primary]}
          />
        }
      >
        {/* ── 1. ORDER PROGRESS TIMELINE ── */}
        <OrderTimeline
          status={booking.status}
          createdAt={booking.createdAt}
          startDate={booking.startDate}
          endDate={booking.endDate}
          timeline={booking.timeline}
        />

        {/* ── 2. UNIFIED CARD: DEVICE & OWNER INFO ── */}
        <View style={styles.unifiedCard}>
          {/* Device Info */}
          <View style={styles.deviceRow}>
            <Image
              source={{ uri: device.images?.[0] || 'https://via.placeholder.com/150' }}
              style={styles.deviceImage}
            />
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName} numberOfLines={2}>
                {device.name || device.title || STRINGS.BOOKING_DETAIL.DEFAULT_DEVICE_NAME}
              </Text>
              <Text style={styles.deviceSub}>
                {device.brand ? `${device.brand} • ` : ''}
                {device.category || STRINGS.BOOKING_DETAIL.DEFAULT_CATEGORY}
              </Text>
              <Text style={styles.devicePrice}>
                {(
                  device.pricePerDay ||
                  device.dailyRate ||
                  booking.pricePerDayAtBooking ||
                  0
                ).toLocaleString('en-US')}{' '}
                {STRINGS.BOOKING_DETAIL.VND_PER_DAY}
              </Text>
            </View>
          </View>

          <View style={styles.subtleDivider} />

          {/* Owner Info & Direct Chat */}
          <View style={styles.ownerRow}>
            <Image
              source={{ uri: owner.avatar || 'https://via.placeholder.com/100' }}
              style={styles.ownerAvatar}
            />
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName} numberOfLines={1}>
                {owner.name || STRINGS.BOOKING_DETAIL.DEFAULT_OWNER_NAME}
              </Text>
              <View style={styles.ownerMetaRow}>
                <View style={styles.ownerRatingBadge}>
                  <Ionicons name="star" size={11} color={colors.light.ratingStar} />
                  <Text style={styles.ownerRatingText}>
                    {owner.rating ? Number(owner.rating).toFixed(1) : '5.0'}
                  </Text>
                </View>
                <Text style={styles.ownerRoleSub}>• Device Owner</Text>
              </View>
            </View>

            {/* Chat Button */}
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChatWithOwner}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={15} color={colors.light.white} />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. UNIFIED CARD: RENTAL SCHEDULE & DELIVERY ── */}
        <View style={styles.unifiedCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="calendar" size={15} color={colors.light.primary} />
              </View>
              <Text style={styles.cardTitle}>{STRINGS.BOOKING_DETAIL.RENTAL_PERIOD}</Text>
            </View>
            <View style={styles.periodDurationPill}>
              <Ionicons name="time-outline" size={13} color={colors.light.primary} />
              <Text style={styles.periodDurationText}>
                {durationBetweenDates.formattedLabel}
              </Text>
            </View>
          </View>

          {/* Balanced Pickup & Return Schedule Route Card */}
          <View style={styles.routeContainer}>
            {/* Pickup Point */}
            <View style={styles.pickupCard}>
              <View style={styles.nodeHeaderRow}>
                <View style={[styles.nodeIndicatorDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.nodeTypeLabel, { color: '#059669' }]}>
                  {STRINGS.BOOKING_DETAIL.PICKUP}
                </Text>
              </View>
              <Text style={styles.nodeDateText} numberOfLines={1}>
                {pickupInfo.dateStr}
              </Text>
              <View style={styles.pickupTimePill}>
                <Ionicons name="time-outline" size={11} color="#059669" />
                <Text style={styles.pickupTimeText} numberOfLines={1}>
                  {pickupInfo.weekdayStr} • {pickupInfo.timeStr}
                </Text>
              </View>
            </View>

            {/* Center Track: Arrow Icon & Duration Hours */}
            <View style={styles.routeCenterTrack}>
              <View style={styles.trackArrowCircle}>
                <Ionicons name="arrow-forward" size={13} color={colors.light.primary} />
              </View>
              <View style={styles.trackBadge}>
                <Text style={styles.trackBadgeText}>{durationBetweenDates.hoursBadge}</Text>
              </View>
            </View>

            {/* Return Point */}
            <View style={styles.returnCard}>
              <View style={styles.nodeHeaderRow}>
                <View style={[styles.nodeIndicatorDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.nodeTypeLabel, { color: '#D97706' }]}>
                  {STRINGS.BOOKING_DETAIL.RETURN}
                </Text>
              </View>
              <Text style={styles.nodeDateText} numberOfLines={1}>
                {returnInfo.dateStr}
              </Text>
              <View style={styles.returnTimePill}>
                <Ionicons name="time-outline" size={11} color="#D97706" />
                <Text style={styles.returnTimeText} numberOfLines={1}>
                  {returnInfo.weekdayStr} • {returnInfo.timeStr}
                </Text>
              </View>
            </View>
          </View>

          {/* RENTAL COUNTDOWN TIMER: RUNS WHEN CURRENT TIME REACHES STARTDATE */}
          {isActive && (
            <View style={styles.timerSection}>
              <RentalCountdownTimer
                startDate={booking.startDate}
                endDate={booking.endDate}
              />
            </View>
          )}

          {/* Extension request pending review info */}
          {isPendingExtension && (
            <View style={styles.extensionInfoPending}>
              <Ionicons name="hourglass" size={16} color={colors.light.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.extensionTitlePending}>
                  {STRINGS.BOOKING_DETAIL.EXTENSION_PENDING_TITLE}
                </Text>
                <Text style={styles.extensionDescPending}>
                  {STRINGS.BOOKING_DETAIL.EXTENSION_PENDING_DESC(
                    booking.extensionRequest?.requestedDays || 0,
                    booking.extensionRequest?.additionalFee || 0,
                    new Date(
                      booking.extensionRequest?.requestedEndDate || ''
                    ).toLocaleDateString('en-US')
                  )}
                </Text>
              </View>
            </View>
          )}

          {isApprovedExtension && (
            <View style={styles.extensionInfoApproved}>
              <Ionicons name="checkmark-circle" size={16} color={colors.light.success} />
              <Text style={styles.extensionTitleApproved}>
                {STRINGS.BOOKING_DETAIL.EXTENSION_APPROVED_TITLE(
                  booking.extensionRequest?.requestedDays || 0
                )}
              </Text>
            </View>
          )}

          <View style={styles.subtleDivider} />

          {/* Delivery method & address */}
          <View style={styles.deliveryContainer}>
            <View style={styles.deliveryMethodRow}>
              <Ionicons
                name={booking.deliveryMethod === 'delivery' ? 'bicycle' : 'storefront-outline'}
                size={18}
                color={colors.light.primary}
              />
              <Text style={styles.deliveryMethodText}>
                {booking.deliveryMethod === 'delivery'
                  ? STRINGS.BOOKING_DETAIL.DOORSTEP_DELIVERY
                  : STRINGS.BOOKING_DETAIL.SELF_PICKUP}
              </Text>
            </View>
            <Text style={styles.deliveryAddressText}>
              {booking.deliveryAddress || device.addressText || STRINGS.BOOKING_DETAIL.CONTACT_OWNER}
            </Text>
          </View>
        </View>

        {/* ── 4. PRICING & PAYMENT ── */}
        <View style={styles.unifiedCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="receipt-outline" size={17} color={colors.light.primary} />
              <Text style={styles.cardTitle}>{STRINGS.BOOKING_DETAIL.PAYMENT_DETAILS}</Text>
            </View>
            <View style={[styles.paymentStatusPill, { backgroundColor: paymentConfig.color + '18' }]}>
              <Text style={[styles.paymentStatusPillText, { color: paymentConfig.color }]}>
                {paymentConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>
              {STRINGS.BOOKING_DETAIL.RENTAL_FEE} ({booking.totalDays}{' '}
              {STRINGS.BOOKING_DETAIL.DAY_UNIT(booking.totalDays)} ×{' '}
              {(
                booking.pricePerDayAtBooking ||
                device.pricePerDay ||
                device.dailyRate ||
                0
              ).toLocaleString('en-US')}{' '}
              VND):
            </Text>
            <Text style={styles.feeValue}>
              {(booking.rentalFee || 0).toLocaleString('en-US')} VND
            </Text>
          </View>

          {booking.depositFee ? (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>{STRINGS.BOOKING_DETAIL.SECURITY_DEPOSIT}</Text>
              <Text style={styles.feeValue}>
                {booking.depositFee.toLocaleString('en-US')} VND
              </Text>
            </View>
          ) : null}

          {booking.voucherDiscount ? (
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.light.success }]}>
                {STRINGS.BOOKING_DETAIL.DISCOUNT_VOUCHER} ({booking.voucherCode || 'Promo'}):
              </Text>
              <Text style={[styles.feeValue, { color: colors.light.success }]}>
                -{booking.voucherDiscount.toLocaleString('en-US')} VND
              </Text>
            </View>
          ) : null}

          <View style={styles.subtleDivider} />

          <View style={styles.feeTotalRow}>
            <Text style={styles.feeTotalLabel}>{STRINGS.BOOKING_DETAIL.TOTAL_AMOUNT}</Text>
            <Text style={styles.feeTotalValue}>
              {(booking.totalAmount || 0).toLocaleString('en-US')} VND
            </Text>
          </View>
        </View>

        {/* ── 5. HANDOVER RECORD & PHOTOS ── */}
        {showHandoverCard && (
          <View style={styles.unifiedCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="shield-checkmark" size={17} color={colors.light.success} />
                <Text style={styles.cardTitle}>{STRINGS.BOOKING_DETAIL.HANDOVER_RECORD}</Text>
              </View>
              {beforePhotos.length > 0 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountBadgeText}>
                    {STRINGS.BOOKING_DETAIL.PHOTOS_COUNT(beforePhotos.length)}
                  </Text>
                </View>
              )}
            </View>

            {beforePhotos.length > 0 ? (
              <View style={styles.handoverPhotosWrap}>
                <Text style={styles.handoverPhotosDesc}>
                  {STRINGS.BOOKING_DETAIL.PHOTOS_DESC}
                </Text>

                <View style={styles.photoGrid}>
                  {beforePhotos.map((url: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.photoThumbItem}
                      onPress={() => setPreviewImage(url)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: url }} style={styles.photoThumbImage} />
                      <View style={styles.photoThumbTag}>
                        <Text style={styles.photoThumbTagText}>
                          {STRINGS.BOOKING_DETAIL.ANGLE_PREFIX}{idx + 1}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {beforeNote ? (
                  <View style={styles.conditionNoteBox}>
                    <Text style={styles.conditionNoteTitle}>
                      {STRINGS.BOOKING_DETAIL.CONDITION_NOTES}
                    </Text>
                    <Text style={styles.conditionNoteContent}>{beforeNote}</Text>
                  </View>
                ) : null}

                {booking.status === 'approved' && (
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => setHandoverCameraModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.light.primary} />
                    <Text style={styles.retakeBtnText}>
                      {STRINGS.BOOKING_DETAIL.UPDATE_RETAKE_PHOTOS}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptyHandoverBox}>
                <View style={styles.emptyHandoverIcon}>
                  <Ionicons name="camera-outline" size={26} color={colors.light.primary} />
                </View>
                <Text style={styles.emptyHandoverTitle}>{STRINGS.BOOKING_DETAIL.NO_PHOTOS_TITLE}</Text>
                <Text style={styles.emptyHandoverDesc}>
                  {booking.status === 'approved'
                    ? STRINGS.BOOKING_DETAIL.NO_PHOTOS_DESC
                    : STRINGS.BOOKING_DETAIL.NO_PHOTOS_ACTIVE_DESC}
                </Text>
                {booking.status === 'approved' && (
                  <TouchableOpacity
                    style={styles.takePhotosCta}
                    onPress={() => setHandoverCameraModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera" size={16} color={colors.light.white} />
                    <Text style={styles.takePhotosCtaText}>
                      {STRINGS.BOOKING_DETAIL.TAKE_PHOTOS_CTA}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Quick handover QR button (only visible when approved) */}
            {booking.status === 'approved' && (
              <TouchableOpacity
                style={styles.openQrCta}
                onPress={() => setQrModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code-outline" size={18} color={colors.light.primary} />
                <Text style={styles.openQrCtaText}>{STRINGS.BOOKING_DETAIL.SHOW_QR_CTA}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.light.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      {/* Only show bottom bar when actions are available */}
      {(booking.status === 'pending' ||
        booking.status === 'approved' ||
        (isActive && !isPendingExtension) ||
        booking.status === 'completed') && (
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
          {/* Pending: Cancel booking button */}
          {booking.status === 'pending' && (
            <TouchableOpacity
              style={[styles.cancelBtn, isCancelling && { opacity: 0.6 }]}
              onPress={handleCancelBooking}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.light.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={colors.light.error} />
                  <Text style={styles.cancelBtnText}>{STRINGS.BOOKING_DETAIL.CANCEL_BOOKING}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Approved: QR code & handover photo buttons */}
          {booking.status === 'approved' && (
            <View style={styles.approvedActionRow}>
              <TouchableOpacity
                style={styles.qrPrimaryBtn}
                onPress={() => setQrModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code" size={18} color={colors.light.white} />
                <Text style={styles.qrPrimaryBtnText}>{STRINGS.BOOKING_DETAIL.HANDOVER_QR_BTN}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraSecondaryBtn}
                onPress={() => setHandoverCameraModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color={colors.light.primary} />
                <Text style={styles.cameraSecondaryBtnText}>
                  {STRINGS.BOOKING_DETAIL.TAKE_PHOTOS_BTN}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Active: Extend rental button (hidden when pending approval) */}
          {isActive && !isPendingExtension && (
            <TouchableOpacity
              style={styles.actionPrimaryBtn}
              onPress={() => setExtensionModalVisible(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.light.white} />
              <Text style={styles.actionPrimaryBtnText}>
                {STRINGS.BOOKING_DETAIL.EXTEND_RENTAL}
              </Text>
            </TouchableOpacity>
          )}

          {/* Completed: Review or Rent again (for Renter) */}
          {booking.status === 'completed' && (() => {
            const currentUserId = currentUser?._id || (currentUser as any)?.id;
            const isOwner = Boolean(
              currentUserId &&
              ((booking.ownerId as any)?._id === currentUserId || booking.ownerId === currentUserId)
            );

            // Owner does not rate renter
            if (isOwner) return null;

            return booking.isReviewed ? (
              <TouchableOpacity style={styles.reRentBtn} onPress={handleReRent}>
                <Ionicons name="repeat" size={18} color={colors.light.white} />
                <Text style={styles.reRentBtnText}>{STRINGS.BOOKING_DETAIL.RENT_AGAIN}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reviewActionBtn}
                onPress={() => setReviewModalVisible(true)}
              >
                <Ionicons name="star" size={18} color={colors.light.white} />
                <Text style={styles.reviewActionBtnText}>
                  {STRINGS.BOOKING_DETAIL.REVIEW_QUALITY_BTN}
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      )}

      {/* ── MODALS ── */}
      <ExtensionModal
        visible={extensionModalVisible}
        booking={booking}
        onClose={() => setExtensionModalVisible(false)}
        onSuccess={fetchDetail}
      />

      <ReviewModal
        visible={reviewModalVisible}
        booking={booking}
        onClose={() => setReviewModalVisible(false)}
        onSuccess={() => {
          setBooking((prev) => (prev ? { ...prev, isReviewed: true } : prev));
          fetchDetail();
        }}
      />

      <HandoverQrModal
        visible={qrModalVisible}
        booking={booking}
        onClose={() => setQrModalVisible(false)}
      />

      <HandoverCameraModal
        visible={handoverCameraModalVisible}
        booking={booking}
        onClose={() => setHandoverCameraModalVisible(false)}
        onSuccess={fetchDetail}
      />

      {/* FULL IMAGE PREVIEW MODAL */}
      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImage(null)}>
          <View style={styles.previewContainer}>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewImage(null)}
            >
              <Ionicons name="close" size={24} color={colors.light.white} />
            </TouchableOpacity>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.fullPreviewImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* CUSTOM CANCEL CONFIRMATION MODAL */}
      <BookingCancelModal
        visible={cancelModalVisible}
        bookingCode={booking.bookingCode}
        isCancelling={isCancelling}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={executeCancelBooking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.light.surface,
  },
  loadingText: {
    fontSize: 14,
    color: colors.light.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    color: colors.light.white,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    gap: 12,
  },
  headerBackBtn: {
    padding: 4,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  unifiedCard: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  subtleDivider: {
    height: 1,
    backgroundColor: colors.light.borderSubtle,
    marginVertical: 2,
  },
  deviceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deviceImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.light.borderSubtle,
  },
  deviceInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 20,
  },
  deviceSub: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  devicePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primaryDark,
    marginTop: 2,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.light.borderSubtle,
    marginRight: 10,
  },
  ownerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    marginRight: 8,
  },
  ownerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  ownerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.light.warningLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ownerRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  ownerRoleSub: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexShrink: 0,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.white,
  },
  headerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodDurationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primaryLight + '40',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  periodDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    marginTop: 2,
  },
  pickupCard: {
    flex: 1,
    backgroundColor: colors.light.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
    gap: 4,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  returnCard: {
    flex: 1,
    backgroundColor: colors.light.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
    gap: 4,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  nodeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nodeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nodeTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nodeDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  pickupTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 1,
  },
  pickupTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  returnTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 1,
  },
  returnTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  routeCenterTrack: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  trackArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  trackBadge: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  trackBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.light.primary,
  },
  timerSection: {
    marginTop: 2,
  },
  timerPendingStartBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.primaryBg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  timerPendingStartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  timerPendingStartDesc: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: 1,
    lineHeight: 15,
  },
  extensionInfoPending: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.light.warningLight,
    padding: 10,
    borderRadius: 10,
  },
  extensionTitlePending: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.warning,
  },
  extensionDescPending: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: 1,
    lineHeight: 15,
  },
  extensionInfoApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.successLight,
    padding: 10,
    borderRadius: 10,
  },
  extensionTitleApproved: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.success,
  },
  deliveryContainer: {
    gap: 4,
  },
  deliveryMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryMethodText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  deliveryAddressText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
    marginLeft: 24,
  },
  paymentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  paymentStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 13,
    color: colors.light.textSecondary,
    flex: 1,
  },
  feeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  feeTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  feeTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  photoCountBadge: {
    backgroundColor: colors.light.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  photoCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.success,
  },
  handoverPhotosWrap: {
    gap: 10,
  },
  handoverPhotosDesc: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbItem: {
    width: '48%',
    aspectRatio: 1.3,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.light.borderSubtle,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoThumbTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoThumbTagText: {
    fontSize: 10,
    color: colors.light.white,
    fontWeight: '600',
  },
  conditionNoteBox: {
    backgroundColor: colors.light.background,
    padding: 10,
    borderRadius: 8,
    gap: 3,
  },
  conditionNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  conditionNoteContent: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primaryLight,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retakeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  emptyHandoverBox: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.light.background,
    borderRadius: 12,
    gap: 4,
  },
  emptyHandoverIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyHandoverTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  emptyHandoverDesc: {
    fontSize: 11,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  takePhotosCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  takePhotosCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.white,
  },
  openQrCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  openQrCtaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primaryDark,
    marginLeft: 8,
  },
  bottomBar: {
    backgroundColor: colors.light.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.dangerLight,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.error,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.error,
  },
  approvedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qrPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.white,
  },
  cameraSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primaryLight,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.primary,
  },
  cameraSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primary,
  },
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
  reRentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  reRentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light.warning,
    paddingVertical: 13,
    borderRadius: 12,
  },
  reviewActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
  ratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  ratedBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullPreviewImage: {
    width: '95%',
    height: '80%',
  },
});
