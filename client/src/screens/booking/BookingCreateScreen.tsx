import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { deviceService } from '../../services/deviceService';
import { bookingService } from '../../services/bookingService';
import { apiClient } from '../../config/api';
import { Device } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { useAppSelector } from '../../store';
import { PriceBreakdownCard } from './components/PriceBreakdownCard';
import { BookingSuccessModal } from './components/BookingSuccessModal';
import BookingResultModal from './components/BookingResultModal';

interface BookingCreateScreenProps {
  deviceId: string;
  onBack: () => void;
  onSuccess?: () => void;
  onNavigateToVerification?: () => void;
  onNavigateToLogin?: () => void;
}

const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US') + ' VND';
};

const formatDateOnly = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatTimeOnly = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getDayOfWeekName = (d: Date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
};

const getLocalYMD = (d: Date) => {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function BookingCreateScreen({
  deviceId,
  onBack,
  onSuccess,
  onNavigateToVerification,
  onNavigateToLogin,
}: BookingCreateScreenProps) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 24 : 16
  );

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [busyRanges, setBusyRanges] = useState<
    { _id: string; startDate: string; endDate: string; status: string; bookingCode?: string }[]
  >([]);

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const userAddressText =
    typeof currentUser?.address === 'string'
      ? currentUser.address
      : currentUser?.address?.fullAddress || '';
  const [deliveryAddress, setDeliveryAddress] = useState(userAddressText);

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    type: 'start' | 'end';
  }>({ visible: false, type: 'start' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirmAction?: () => void;
  }>({
    visible: false,
    type: 'error',
    title: '',
    message: '',
  });

  const showBookingResult = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    confirmText = 'OK',
    cancelText?: string,
    onConfirmAction?: () => void
  ) => {
    setResultModal({ visible: true, type, title, message, confirmText, cancelText, onConfirmAction });
  };

  useEffect(() => {
    if (userAddressText && !deliveryAddress) {
      setDeliveryAddress(userAddressText);
    }
  }, [userAddressText]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const [deviceData, ranges] = await Promise.all([
          deviceService.getDeviceById(deviceId),
          bookingService.getDeviceBusyDates(deviceId).catch(() => []),
        ]);
        if (isMounted) {
          setDevice(deviceData);
          setBusyRanges(ranges);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [deviceId]);

  const checkOverlapWithBusy = (start: Date, end: Date) => {
    for (const b of busyRanges) {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      if (bEnd.getHours() === 0 && bEnd.getMinutes() === 0 && bEnd.getSeconds() === 0) {
        bEnd.setHours(23, 59, 59, 999);
      }
      if (start < bEnd && end > bStart) {
        return b;
      }
    }
    return null;
  };

  const isDateInBusyRange = (d: Date) => {
    const dTime = d.getTime();
    const dYMD = getLocalYMD(d);

    for (const b of busyRanges) {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      const startYMD = getLocalYMD(bStart);
      const endYMD = getLocalYMD(bEnd);

      if (dTime >= bStart.getTime() && dTime <= bEnd.getTime()) {
        return b;
      }
      if (dYMD >= startYMD && dYMD <= endYMD) {
        return b;
      }
    }
    return null;
  };

  const openPicker = (type: 'start' | 'end') => {
    setPickerConfig({ visible: true, type });
  };

  const handleConfirmPicker = (date: Date): { title: string; message: string } | null => {
    const now = new Date(Date.now() - 2 * 60 * 1000);

    if (pickerConfig.type === 'start') {
      if (date < now) {
        return {
          title: STRINGS.BOOKING_CREATE.INVALID_TIME_TITLE,
          message: STRINGS.BOOKING_CREATE.PAST_TIME_MSG,
        };
      }

      const conflict = isDateInBusyRange(date);
      if (conflict) {
        const fromStr = formatDateOnly(new Date(conflict.startDate));
        const toStr = formatDateOnly(new Date(conflict.endDate));
        return {
          title: STRINGS.BOOKING_CREATE.DATES_UNAVAILABLE_TITLE,
          message: `The device is booked between ${fromStr} and ${toStr}. Please select another time!`,
        };
      }

      setStartDate(date);

      // Tự động gán hoặc điều chỉnh endDate để đảm bảo tối thiểu 12 giờ
      if (!endDate || endDate.getTime() - date.getTime() < 12 * 60 * 60 * 1000) {
        const autoEnd = new Date(date.getTime() + 12 * 60 * 60 * 1000);
        const rangeConflict = checkOverlapWithBusy(date, autoEnd);
        if (!rangeConflict) {
          setEndDate(autoEnd);
        } else {
          setEndDate(null);
        }
      } else {
        const rangeConflict = checkOverlapWithBusy(date, endDate);
        if (rangeConflict) {
          setEndDate(null);
        }
      }
    } else {
      if (!startDate) {
        return {
          title: STRINGS.BOOKING_CREATE.MISSING_INFO_TITLE,
          message: STRINGS.BOOKING_CREATE.SELECT_PICKUP_FIRST,
        };
      }

      const minReturnTime = new Date(startDate.getTime() + 12 * 60 * 60 * 1000);
      const minReturnStr = `${formatTimeOnly(minReturnTime)}, ${formatDateOnly(minReturnTime)} (${getDayOfWeekName(minReturnTime)})`;

      if (date <= startDate) {
        return {
          title: STRINGS.BOOKING_CREATE.INVALID_TIME_TITLE,
          message: 'Return time must be after pickup time.',
        };
      }

      // Ràng buộc thời gian thuê tối thiểu 12 giờ
      const diffMs = date.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 12) {
        return {
          title: STRINGS.BOOKING_CREATE.MIN_RENTAL_HOURS_TITLE,
          message: STRINGS.BOOKING_CREATE.MIN_RENTAL_HOURS_DYNAMIC(minReturnStr),
        };
      }

      const rangeConflict = checkOverlapWithBusy(startDate, date);
      if (rangeConflict) {
        const fromStr = formatDateOnly(new Date(rangeConflict.startDate));
        const toStr = formatDateOnly(new Date(rangeConflict.endDate));
        return {
          title: STRINGS.BOOKING_CREATE.SCHEDULE_CONFLICT_TITLE,
          message: `The device has an existing booking between ${fromStr} and ${toStr}. Please select another return time!`,
        };
      }

      setEndDate(date);
    }
    setPickerConfig({ ...pickerConfig, visible: false });
    return null;
  };

  const durationInfo = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalHours: 0, days: 0, hours: 0, billableDays: 0, displayText: '', isBelowMin: false };
    }
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    const totalHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const billableDays = Math.max(1, Math.ceil(totalHours / 24));
    const isBelowMin = totalHours < 12;

    let displayText = '';
    if (days > 0 && hours > 0) {
      displayText = `${days}d ${hours}h (${totalHours}h)`;
    } else if (days > 0) {
      displayText = `${days}d (${totalHours}h)`;
    } else {
      displayText = `${totalHours} hours`;
    }

    return { totalHours, days, hours, billableDays, displayText, isBelowMin };
  }, [startDate, endDate]);

  const calculateDays = () => durationInfo.billableDays;

  // Xử lý chọn nhanh thời lượng (Tối thiểu 12h, 24h, 2 ngày, 3 ngày, 1 tuần)
  const handleQuickSelectDuration = (hours: number) => {
    let base = startDate;
    if (!base) {
      base = new Date();
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
      setStartDate(base);
    }
    const newEnd = new Date(base.getTime() + hours * 60 * 60 * 1000);
    const rangeConflict = checkOverlapWithBusy(base, newEnd);
    if (rangeConflict) {
      const fromStr = formatDateOnly(new Date(rangeConflict.startDate));
      const toStr = formatDateOnly(new Date(rangeConflict.endDate));
      showBookingResult(
        'error',
        STRINGS.BOOKING_CREATE.SCHEDULE_CONFLICT_TITLE,
        `The device has an existing booking between ${fromStr} and ${toStr}. Please select another duration!`
      );
      return;
    }
    setEndDate(newEnd);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.light.primary} />
        <Text style={styles.loadingText}>{STRINGS.BOOKING_DETAIL.LOADING}</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.light.error} />
        <Text style={styles.errorTitle}>{STRINGS.BOOKING_DETAIL.NOT_FOUND}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{STRINGS.BOOKING_DETAIL.GO_BACK}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const deviceDailyRate = device.dailyRate || (device as any).pricePerDay || 0;
  const deviceDepositValue = device.depositValue || (device as any).depositAmount || 0;
  const rentalDays = calculateDays();
  const totalRentalHours = durationInfo.totalHours;
  // Tính tiền chính xác theo giờ: (giá thuê 1 ngày / 24h) * số giờ thuê thực tế
  const hourlyRate = deviceDailyRate / 24;
  const baseRentalFee = Math.round(hourlyRate * totalRentalHours);

  let longTermDiscountPercent = 0;
  // 72h = 3 ngày: 10%, 168h = 7 ngày: 20%
  if (totalRentalHours >= 168) longTermDiscountPercent = 20;
  else if (totalRentalHours >= 72) longTermDiscountPercent = 10;

  const longTermDiscountAmount = Math.round((baseRentalFee * longTermDiscountPercent) / 100);
  const rentalFeeAfterLongTerm = baseRentalFee - longTermDiscountAmount;
  const totalAmount = rentalFeeAfterLongTerm + deviceDepositValue;

  const handleConfirm = async () => {
    if (!currentUser) {
      showBookingResult(
        'warning',
        STRINGS.AUTH_LOGIN_ALERT.TITLE,
        STRINGS.AUTH_LOGIN_ALERT.MSG,
        STRINGS.AUTH_LOGIN_ALERT.LOGIN_NOW,
        STRINGS.AUTH_LOGIN_ALERT.LATER,
        () => {
          setResultModal((prev) => ({ ...prev, visible: false }));
          if (onNavigateToLogin) onNavigateToLogin();
        }
      );
      return;
    }

    if (currentUser?.role === 'renter' && !currentUser.isVerified) {
      showBookingResult(
        'warning',
        STRINGS.AUTH_VERIFY_ALERT.TITLE,
        STRINGS.AUTH_VERIFY_ALERT.MSG,
        STRINGS.AUTH_VERIFY_ALERT.VERIFY_NOW,
        STRINGS.AUTH_VERIFY_ALERT.LATER,
        () => {
          setResultModal((prev) => ({ ...prev, visible: false }));
          if (onNavigateToVerification) onNavigateToVerification();
        }
      );
      return;
    }

    if (!startDate || !endDate) {
      showBookingResult(
        'error',
        STRINGS.BOOKING_CREATE.MISSING_INFO_TITLE,
        STRINGS.BOOKING_CREATE.MISSING_DATES_MSG
      );
      return;
    }

    // Kiểm tra thời lượng tối thiểu 12 giờ
    const diffHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (diffHours < 12) {
      const minReturn = new Date(startDate.getTime() + 12 * 60 * 60 * 1000);
      const minReturnStr = `${formatTimeOnly(minReturn)}, ${formatDateOnly(minReturn)} (${getDayOfWeekName(minReturn)})`;
      showBookingResult(
        'error',
        STRINGS.BOOKING_CREATE.MIN_RENTAL_HOURS_TITLE,
        STRINGS.BOOKING_CREATE.MIN_RENTAL_HOURS_DYNAMIC(minReturnStr)
      );
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      showBookingResult(
        'error',
        STRINGS.BOOKING_CREATE.MISSING_INFO_TITLE,
        STRINGS.BOOKING_CREATE.MISSING_DELIVERY_ADDRESS_MSG
      );
      return;
    }

    const conflict = checkOverlapWithBusy(startDate, endDate);
    if (conflict) {
      const fromStr = formatDateOnly(new Date(conflict.startDate));
      const toStr = formatDateOnly(new Date(conflict.endDate));
      showBookingResult(
        'error',
        STRINGS.BOOKING_CREATE.DEVICE_RENTED_TITLE,
        `The device is already booked between ${fromStr} and ${toStr}. Please select another schedule!`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/bookings', {
        deviceId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        deliveryMethod,
        deliveryAddress:
          deliveryMethod === 'delivery'
            ? deliveryAddress.trim()
            : device.addressText || (device.location?.address ?? ''),
        note: orderNote.trim(),
      });

      setSuccessModalVisible(true);
    } catch (error: any) {
      const responseData = error.response?.data;

      if (responseData?.code === 'RENTER_EKYC_REQUIRED') {
        showBookingResult(
          'warning',
          STRINGS.AUTH_VERIFY_ALERT.TITLE,
          responseData.message || STRINGS.AUTH_VERIFY_ALERT.MSG,
          STRINGS.AUTH_VERIFY_ALERT.VERIFY_NOW,
          STRINGS.AUTH_VERIFY_ALERT.LATER,
          () => {
            setResultModal((prev) => ({ ...prev, visible: false }));
            if (onNavigateToVerification) onNavigateToVerification();
          }
        );
      } else {
        showBookingResult(
          'error',
          'Booking Failed',
          responseData?.message || 'Unable to create booking request. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled =
    !startDate ||
    !endDate ||
    durationInfo.isBelowMin ||
    isSubmitting ||
    (deliveryMethod === 'delivery' && !deliveryAddress.trim());

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header - E-commerce Clean Title */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.BOOKING_CREATE.CHECKOUT_TITLE}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. SẢN PHẨM (Product Item) ── */}
        <View style={styles.checkoutCard}>
          {/* Shop Row */}
          <View style={styles.shopRow}>
            <Ionicons name="storefront-outline" size={15} color={colors.light.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.shopName} numberOfLines={1}>
              {(device.ownerId as any)?.name || 'Verified Tech Owner'}
            </Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color={colors.light.success} />
              <Text style={styles.verifiedBadgeText}>{STRINGS.BOOKING_CREATE.VERIFIED_GENUINE}</Text>
            </View>
          </View>

          {/* Product Detail Row */}
          <View style={styles.productRow}>
            <Image
              source={{ uri: device.images?.[0] || 'https://via.placeholder.com/150' }}
              style={styles.productThumb}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {device.title || (device as any).name}
              </Text>
              <Text style={styles.productSpecs}>
                {device.brand || 'Tech'} • {device.category || 'Device'} • Inspected
              </Text>
              <View style={styles.productPriceRow}>
                <Text style={styles.productPrice}>
                  {formatPrice(deviceDailyRate)}
                  <Text style={styles.productPriceUnit}> / day</Text>
                </Text>
                {deviceDepositValue > 0 && (
                  <View style={styles.depositPill}>
                    <Text style={styles.depositPillText}>
                      Deposit: {formatPrice(deviceDepositValue)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── 2. THỜI GIAN THUÊ (Rental Schedule - Dễ nhìn & Nút chọn rõ ràng) ── */}
        <View style={styles.checkoutCard}>
          <View style={styles.cardHeaderWithBadge}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="calendar-outline" size={16} color={colors.light.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.cardHeaderTitle}>{STRINGS.BOOKING_CREATE.RENTAL_SCHEDULE_TITLE}</Text>
            </View>
            <View style={styles.minHoursBadge}>
              <Ionicons name="alert-circle" size={11} color={colors.light.primaryDark} style={{ marginRight: 3 }} />
              <Text style={styles.minHoursBadgeText}>{STRINGS.BOOKING_CREATE.MIN_RENTAL_BADGE}</Text>
            </View>
          </View>

          {/* Step 1: Pickup Action Card */}
          <TouchableOpacity
            style={[styles.scheduleActionCard, startDate && styles.scheduleActionCardActive]}
            onPress={() => openPicker('start')}
            activeOpacity={0.75}
          >
            <View style={[styles.scheduleIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="log-in-outline" size={20} color="#10B981" />
            </View>

            <View style={styles.scheduleInfoCol}>
              <Text style={styles.scheduleStepLabel}>{STRINGS.BOOKING_CREATE.PICKUP_LABEL}</Text>
              <Text
                style={startDate ? styles.scheduleDateValue : styles.scheduleDatePlaceholder}
                numberOfLines={1}
              >
                {startDate
                  ? `${formatTimeOnly(startDate)} - ${formatDateOnly(startDate)} (${getDayOfWeekName(startDate)})`
                  : STRINGS.BOOKING_CREATE.SELECT_PICKUP_HINT}
              </Text>
            </View>

            {startDate ? (
              <View style={styles.actionPillBtnOutlined}>
                <Ionicons name="create-outline" size={13} color={colors.light.primary} />
                <Text style={styles.actionPillBtnTextOutlined}>Change</Text>
              </View>
            ) : (
              <View style={styles.actionPillBtn}>
                <Ionicons name="calendar" size={13} color="#FFFFFF" />
                <Text style={styles.actionPillBtnText}>Select date</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Step 2: Return Action Card */}
          <TouchableOpacity
            style={[styles.scheduleActionCard, endDate && styles.scheduleActionCardActive]}
            onPress={() => openPicker('end')}
            activeOpacity={0.75}
          >
            <View style={[styles.scheduleIconCircle, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="log-out-outline" size={20} color="#F59E0B" />
            </View>

            <View style={styles.scheduleInfoCol}>
              <Text style={styles.scheduleStepLabel}>{STRINGS.BOOKING_CREATE.RETURN_LABEL}</Text>
              <Text
                style={endDate ? styles.scheduleDateValue : styles.scheduleDatePlaceholder}
                numberOfLines={1}
              >
                {endDate
                  ? `${formatTimeOnly(endDate)} - ${formatDateOnly(endDate)} (${getDayOfWeekName(endDate)})`
                  : STRINGS.BOOKING_CREATE.SELECT_RETURN_HINT}
              </Text>
            </View>

            {endDate ? (
              <View style={[styles.actionPillBtnOutlined, { borderColor: '#F59E0B' }]}>
                <Ionicons name="create-outline" size={13} color="#F59E0B" />
                <Text style={[styles.actionPillBtnTextOutlined, { color: '#F59E0B' }]}>Change</Text>
              </View>
            ) : (
              <View style={[styles.actionPillBtn, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="calendar" size={13} color="#FFFFFF" />
                <Text style={styles.actionPillBtnText}>Select date</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Row: Total duration */}
          <View style={styles.scheduleSummaryRow}>
            <View style={styles.scheduleSummaryLeft}>
              <Ionicons name="timer-outline" size={16} color={colors.light.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.scheduleSummaryLabel}>{STRINGS.BOOKING_CREATE.TOTAL_DURATION}</Text>
            </View>
            <View style={styles.scheduleSummaryRight}>
              {durationInfo.totalHours > 0 ? (
                <View style={styles.durationHighlightRow}>
                  <Text style={[styles.durationHighlightText, durationInfo.isBelowMin && { color: colors.light.error }]}>
                    {durationInfo.displayText}
                  </Text>
                  <Text style={styles.billableDaysText}>
                    {durationInfo.totalHours % 24 === 0
                      ? `(${durationInfo.totalHours / 24} ${durationInfo.totalHours / 24 === 1 ? 'day' : 'days'})`
                      : `(~${Math.round(deviceDailyRate / 24).toLocaleString('en-US')} VND/h)`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.schedulePlaceholderText}>{STRINGS.BOOKING_CREATE.NOT_DETERMINED}</Text>
              )}
            </View>
          </View>

          {/* Quick Preset Duration Chips */}
          <View style={styles.quickDurationContainer}>
            <Text style={styles.quickDurationTitle}>{STRINGS.BOOKING_CREATE.QUICK_PRESETS_LABEL}</Text>
            <View style={styles.quickChipsRow}>
              {[
                { hours: 12, label: STRINGS.BOOKING_CREATE.PRESET_12H },
                { hours: 24, label: STRINGS.BOOKING_CREATE.PRESET_24H },
                { hours: 48, label: STRINGS.BOOKING_CREATE.PRESET_2D },
                { hours: 72, label: STRINGS.BOOKING_CREATE.PRESET_3D },
                { hours: 168, label: STRINGS.BOOKING_CREATE.PRESET_1W },
              ].map((item) => {
                const isSelected = durationInfo.totalHours === item.hours && endDate !== null;
                return (
                  <TouchableOpacity
                    key={item.hours}
                    style={[styles.quickChip, isSelected && styles.quickChipSelected]}
                    onPress={() => handleQuickSelectDuration(item.hours)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quickChipText, isSelected && styles.quickChipTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 3. CHI TIẾT THANH TOÁN (Payment Breakdown) ── */}
        <PriceBreakdownCard
          totalHours={durationInfo.totalHours > 0 ? durationInfo.totalHours : undefined}
          rentalDays={rentalDays > 0 ? rentalDays : 1}
          dailyRate={deviceDailyRate}
          depositValue={deviceDepositValue}
        />

        {/* ── 4. HÌNH THỨC NHẬN HÀNG & ĐỊA CHỈ & GHI CHÚ (Handover & Address & Note) ── */}
        <View style={styles.checkoutCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={16} color={colors.light.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeaderTitle}>Handover Method & Address</Text>
          </View>

          {/* Segmented Switch: Nhận tại chỗ vs Giao tận nơi */}
          <View style={styles.deliverySegmentWrapper}>
            <TouchableOpacity
              style={[
                styles.deliverySegmentBtn,
                deliveryMethod === 'pickup' && styles.deliverySegmentBtnActive,
              ]}
              onPress={() => setDeliveryMethod('pickup')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="storefront"
                size={14}
                color={deliveryMethod === 'pickup' ? colors.light.primaryDark : colors.light.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.deliverySegmentText,
                  deliveryMethod === 'pickup' && styles.deliverySegmentTextActive,
                ]}
              >
                {STRINGS.BOOKING_CREATE.SELF_PICKUP_LABEL}
              </Text>
              <View style={styles.freeChip}>
                <Text style={styles.freeChipText}>{STRINGS.BOOKING_CREATE.DELIVERY_FREE}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deliverySegmentBtn,
                deliveryMethod === 'delivery' && styles.deliverySegmentBtnActive,
              ]}
              onPress={() => setDeliveryMethod('delivery')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bicycle"
                size={14}
                color={deliveryMethod === 'delivery' ? colors.light.primaryDark : colors.light.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.deliverySegmentText,
                  deliveryMethod === 'delivery' && styles.deliverySegmentTextActive,
                ]}
              >
                {STRINGS.BOOKING_CREATE.DOORSTEP_DELIVERY_LABEL}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contact & Handover Address */}
          <View style={styles.addressInfoBox}>
            <View style={styles.addressHeaderRow}>
              <View style={styles.addressIconWrap}>
                <Ionicons
                  name={deliveryMethod === 'pickup' ? 'storefront-outline' : 'location'}
                  size={18}
                  color={deliveryMethod === 'pickup' ? colors.light.primaryDark : '#EF4444'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipientName}>
                  {currentUser?.name || 'Customer'}
                  <Text style={styles.recipientPhone}>
                    {'  '}({currentUser?.phone || (currentUser as any)?.phoneNumber || 'No phone number'})
                  </Text>
                </Text>

                {deliveryMethod === 'pickup' ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.addressDetailText}>
                      {device.addressText || device.location?.address || 'Owner will provide meeting location after booking is approved'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.deliveryInputRow}>
                      <TextInput
                        style={styles.deliveryTextInput}
                        placeholder={STRINGS.BOOKING_CREATE.DELIVERY_PLACEHOLDER}
                        placeholderTextColor={colors.light.textMuted}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                        multiline
                      />
                    </View>
                    {userAddressText && deliveryAddress !== userAddressText && (
                      <TouchableOpacity
                        style={styles.fillProfileAddressBtn}
                        onPress={() => setDeliveryAddress(userAddressText)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="bookmark-outline" size={12} color={colors.light.primaryDark} />
                        <Text style={styles.fillProfileAddressText}>{STRINGS.BOOKING_CREATE.USE_SAVED_ADDRESS}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* Integrated Note Row */}
          <View style={styles.noteRow}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.light.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.noteLabel}>{STRINGS.BOOKING_CREATE.NOTE_LABEL}</Text>
            <TextInput
              style={styles.noteInput}
              placeholder={STRINGS.BOOKING_CREATE.NOTE_PLACEHOLDER}
              placeholderTextColor={colors.light.textMuted}
              value={orderNote}
              onChangeText={setOrderNote}
              maxLength={200}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── 6. THANH ĐẶT HÀNG DƯỚI CÙNG (Shopee Sticky Bottom Bar) ── */}
      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomPriceLabel}>{STRINGS.BOOKING_CREATE.TOTAL_PAYMENT_LABEL}</Text>
          <Text style={styles.bottomPriceValue}>
            {durationInfo.totalHours >= 12 ? formatPrice(totalAmount) : '---'}
          </Text>
          <Text style={styles.bottomDepositSub}>
            {durationInfo.totalHours >= 12
              ? STRINGS.BOOKING_CREATE.INCLUDES_REFUNDABLE_DEPOSIT
              : STRINGS.BOOKING_CREATE.MIN_RENTAL_FOOTER_NOTE}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, isConfirmDisabled && styles.checkoutBtnDisabled]}
          onPress={handleConfirm}
          disabled={isConfirmDisabled}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.light.white} />
          ) : (
            <Text style={[styles.checkoutBtnText, isConfirmDisabled && styles.checkoutBtnTextDisabled]}>
              {STRINGS.BOOKING_CREATE.PLACE_ORDER}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <CustomDateTimePicker
        visible={pickerConfig.visible}
        type={pickerConfig.type}
        initialDate={
          pickerConfig.type === 'start'
            ? (startDate || new Date())
            : (endDate || (startDate ? new Date(startDate.getTime() + 12 * 60 * 60 * 1000) : new Date()))
        }
        minDate={
          pickerConfig.type === 'end'
            ? (startDate || new Date())
            : new Date()
        }
        busyRanges={busyRanges}
        onClose={() => setPickerConfig({ ...pickerConfig, visible: false })}
        onConfirm={handleConfirmPicker}
      />

      <BookingSuccessModal
        visible={successModalVisible}
        deviceTitle={device?.title || (device as any)?.name}
        startDate={startDate}
        endDate={endDate}
        rentalDays={rentalDays}
        totalAmount={totalAmount}
        onViewBookings={() => {
          setSuccessModalVisible(false);
          if (onSuccess) {
            onSuccess();
          } else {
            onBack();
          }
        }}
        onClose={() => {
          setSuccessModalVisible(false);
          if (onSuccess) {
            onSuccess();
          } else {
            onBack();
          }
        }}
      />

      <BookingResultModal
        visible={resultModal.visible}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        confirmText={resultModal.confirmText}
        cancelText={resultModal.cancelText}
        onConfirm={resultModal.onConfirmAction}
        onClose={() => {
          setResultModal({ ...resultModal, visible: false });
        }}
      />
    </View>
  );
}

const hoursList = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minutesList = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const quickTimePresets = ['08:00', '10:00', '13:30', '17:30', '20:00'];

const TimeScrollPicker = React.memo(({ items, selectedValue, onValueChange, visible }: any) => {
  const ITEM_HEIGHT = 44;
  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;
    const index = items.indexOf(selectedValue);
    if (index !== -1 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [visible, selectedValue]);

  const handleScrollEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    if (items[clampedIndex] !== selectedValue) {
      onValueChange(items[clampedIndex]);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 70, overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: colors.light.primary,
          backgroundColor: colors.light.primaryLight + '40',
          borderRadius: 8,
          zIndex: 1,
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
      >
        {items.map((item: string) => {
          const isSelected = item === selectedValue;
          return (
            <TouchableOpacity
              key={item}
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => onValueChange(item)}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: isSelected ? 18 : 14,
                  fontWeight: isSelected ? '800' : '500',
                  color: isSelected ? colors.light.primaryDark : colors.light.textSecondary,
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const CustomDateTimePicker = ({
  visible,
  type,
  initialDate,
  minDate,
  busyRanges,
  onClose,
  onConfirm,
}: any) => {
  const [date, setDate] = useState(initialDate || new Date());
  const [hours, setHours] = useState((initialDate || new Date()).getHours().toString().padStart(2, '0'));
  const [minutes, setMinutes] = useState((initialDate || new Date()).getMinutes().toString().padStart(2, '0'));
  const [pickerAlert, setPickerAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (visible) {
      const d = initialDate || new Date();
      setDate(d);
      setHours(d.getHours().toString().padStart(2, '0'));
      setMinutes(d.getMinutes().toString().padStart(2, '0'));
      setPickerAlert(null);
    }
  }, [visible, initialDate]);

  const currentDateStr = getLocalYMD(date);
  const minDateStr = minDate ? getLocalYMD(minDate) : undefined;

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    if (busyRanges && Array.isArray(busyRanges)) {
      busyRanges.forEach((range: any) => {
        const s = new Date(range.startDate);
        const e = new Date(range.endDate);

        const curr = new Date(s);
        curr.setHours(0, 0, 0, 0);

        const endLimit = new Date(e);
        endLimit.setHours(23, 59, 59, 999);

        while (curr <= endLimit) {
          const ymd = getLocalYMD(curr);
          marks[ymd] = {
            disabled: true,
            disableTouchEvent: true,
            marked: true,
            dotColor: colors.light.error,
            textColor: colors.light.textMuted,
          };
          curr.setDate(curr.getDate() + 1);
        }
      });
    }

    marks[currentDateStr] = {
      ...(marks[currentDateStr] || {}),
      selected: true,
      selectedColor: colors.light.primary,
      textColor: colors.light.white,
    };

    return marks;
  }, [busyRanges, currentDateStr]);

  const handleConfirm = () => {
    const finalDate = new Date(date);
    finalDate.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);

    const ymd = getLocalYMD(finalDate);
    if (markedDates[ymd]?.disabled) {
      setPickerAlert({
        title: STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_TITLE,
        message: STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_MSG,
      });
      return;
    }

    const err = onConfirm(finalDate);
    if (err && err.message) {
      setPickerAlert(err);
      return;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View style={styles.modalHeaderIconBadge}>
                <Ionicons
                  name={type === 'start' ? 'log-in-outline' : 'log-out-outline'}
                  size={18}
                  color={colors.light.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {type === 'start'
                    ? STRINGS.BOOKING_CREATE.PICKUP_TIME_TITLE
                    : STRINGS.BOOKING_CREATE.RETURN_TIME_TITLE}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {type === 'start'
                    ? STRINGS.BOOKING_CREATE.PICKUP_TIME_SUB
                    : 'Minimum 12 hours rental duration from pickup time'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            style={styles.modalScrollBody}
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            {/* Live Selection Preview Bar */}
            <View style={styles.modalPreviewBar}>
              <View style={styles.modalPreviewCol}>
                <Text style={styles.modalPreviewLabel}>{STRINGS.BOOKING_CREATE.SELECTED_DATE}</Text>
                <View style={styles.modalPreviewValRow}>
                  <Ionicons name="calendar" size={14} color={colors.light.primary} />
                  <Text style={styles.modalPreviewValText}>
                    {getDayOfWeekName(date)}, {formatDateOnly(date)}
                  </Text>
                </View>
              </View>
              <View style={styles.modalPreviewDivider} />
              <View style={styles.modalPreviewCol}>
                <Text style={styles.modalPreviewLabel}>{STRINGS.BOOKING_CREATE.SELECTED_TIME}</Text>
                <View style={styles.modalPreviewValRow}>
                  <Ionicons name="time" size={14} color={colors.light.primary} />
                  <Text style={styles.modalPreviewValTime}>
                    {hours}:{minutes}
                  </Text>
                </View>
              </View>
            </View>

            {/* Calendar */}
            <View style={styles.calendarContainer}>
              <Calendar
                current={currentDateStr}
                minDate={minDateStr}
                onDayPress={(day: any) => {
                  if (markedDates[day.dateString]?.disabled) {
                    setPickerAlert({
                      title: STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_TITLE,
                      message: STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_MSG,
                    });
                    return;
                  }
                  const [y, m, d] = day.dateString.split('-').map(Number);
                  setDate(new Date(y, m - 1, d));
                }}
                markedDates={markedDates}
                theme={{
                  backgroundColor: colors.light.surface,
                  calendarBackground: colors.light.surface,
                  textSectionTitleColor: colors.light.textSecondary,
                  selectedDayBackgroundColor: colors.light.primary,
                  selectedDayTextColor: colors.light.white,
                  todayTextColor: colors.light.primary,
                  dayTextColor: colors.light.textPrimary,
                  textDisabledColor: colors.light.textMuted,
                  monthTextColor: colors.light.textPrimary,
                  arrowColor: colors.light.primary,
                  textDayFontWeight: '600',
                  textMonthFontWeight: '700',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 14,
                  textMonthFontSize: 15,
                  textDayHeaderFontSize: 12,
                }}
              />
            </View>

            {/* Quick Preset Time Buttons */}
            <View style={styles.timeSection}>
              <View style={styles.presetContainer}>
                <Text style={styles.presetLabel}>{STRINGS.BOOKING_CREATE.TIME_SUGGESTIONS}</Text>
                <View style={styles.presetChipsRow}>
                  {quickTimePresets.map((preset) => {
                    const [h, m] = preset.split(':');
                    const isSelected = hours === h && minutes === m;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                        onPress={() => {
                          setHours(h);
                          setMinutes(m);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.presetChipText, isSelected && styles.presetChipTextSelected]}>
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Scroll Picker with Column Titles */}
              <View style={styles.timePickerCard}>
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerColTitle}>{STRINGS.BOOKING_CREATE.HOUR}</Text>
                  <TimeScrollPicker
                    items={hoursList}
                    selectedValue={hours}
                    onValueChange={setHours}
                    visible={visible}
                  />
                </View>

                <Text style={styles.timeColon}>:</Text>

                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerColTitle}>{STRINGS.BOOKING_CREATE.MINUTE}</Text>
                  <TimeScrollPicker
                    items={minutesList}
                    selectedValue={minutes}
                    onValueChange={setMinutes}
                    visible={visible}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Modal Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.modalBtnTextCancel}>{STRINGS.BOOKING_CREATE.CANCEL_BTN}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleConfirm} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={17} color={colors.light.white} style={{ marginRight: 6 }} />
              <Text style={styles.modalBtnTextConfirm}>{STRINGS.BOOKING_CREATE.CONFIRM_BTN}</Text>
            </TouchableOpacity>
          </View>

          {/* Unified In-Picker Alert Dialog */}
          {pickerAlert && (
            <View style={styles.pickerAlertOverlay}>
              <View style={styles.pickerAlertCard}>
                <TouchableOpacity
                  style={styles.pickerAlertCloseBtn}
                  onPress={() => setPickerAlert(null)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={colors.light.textMuted} />
                </TouchableOpacity>

                <View style={styles.pickerAlertIconCircle}>
                  <Ionicons name="alert-circle-outline" size={26} color={colors.light.error} />
                </View>

                <Text style={styles.pickerAlertTitle}>{pickerAlert.title}</Text>
                <Text style={styles.pickerAlertMessage}>{pickerAlert.message}</Text>

                <TouchableOpacity
                  style={styles.pickerAlertBtn}
                  onPress={() => setPickerAlert(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerAlertBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray e-commerce background
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.light.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: colors.light.error,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: colors.light.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 110,
    gap: 12,
  },
  checkoutCard: {
    backgroundColor: colors.light.surface,
    marginHorizontal: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  deliverySegmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  deliverySegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  deliverySegmentBtnActive: {
    backgroundColor: colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  deliverySegmentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  deliverySegmentTextActive: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  freeChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  freeChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.light.success,
  },
  addressInfoBox: {
    paddingTop: 2,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  recipientPhone: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.light.textSecondary,
  },
  addressDetailText: {
    fontSize: 12.5,
    color: colors.light.textPrimary,
    lineHeight: 18,
    marginTop: 2,
  },
  deliveryInputRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 50,
  },
  deliveryTextInput: {
    fontSize: 12.5,
    color: colors.light.textPrimary,
    padding: 0,
    lineHeight: 18,
  },
  fillProfileAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  fillProfileAddressText: {
    fontSize: 11.5,
    color: colors.light.primaryDark,
    fontWeight: '600',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  shopName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.success,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  productThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.light.borderSubtle,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 19,
    marginBottom: 3,
  },
  productSpecs: {
    fontSize: 11.5,
    color: colors.light.textSecondary,
    marginBottom: 4,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  productPrice: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  productPriceUnit: {
    fontSize: 11.5,
    fontWeight: '400',
    color: colors.light.textSecondary,
  },
  depositPill: {
    backgroundColor: colors.light.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  depositPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 12,
  },
  minHoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  minHoursBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  scheduleActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  scheduleActionCardActive: {
    borderColor: colors.light.primary,
    backgroundColor: '#F0FDFA',
  },
  scheduleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  scheduleInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  scheduleStepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  scheduleDateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  scheduleDatePlaceholder: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.light.primaryDark,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  actionPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionPillBtnOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionPillBtnTextOutlined: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  scheduleSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  scheduleSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleSummaryLabel: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  scheduleSummaryRight: {
    alignItems: 'flex-end',
  },
  schedulePlaceholderText: {
    fontSize: 12.5,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  durationHighlightRow: {
    alignItems: 'flex-end',
  },
  durationHighlightText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  billableDaysText: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  subtleDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
  },
  quickDurationContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickDurationTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  quickChipSelected: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  quickChipTextSelected: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginRight: 8,
  },
  noteInput: {
    flex: 1,
    fontSize: 12.5,
    color: colors.light.textPrimary,
    padding: 0,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarLeft: {
    flex: 1,
    marginRight: 12,
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  bottomPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  bottomDepositSub: {
    fontSize: 10,
    color: colors.light.textMuted,
    marginTop: 1,
  },
  checkoutBtn: {
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8, // E-commerce button radius
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  checkoutBtnDisabled: {
    backgroundColor: colors.light.borderDefault,
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutBtnText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkoutBtnTextDisabled: {
    color: colors.light.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  modalHeaderIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: {
    flexGrow: 0,
  },
  modalPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primaryLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalPreviewCol: {
    flex: 1,
    alignItems: 'center',
  },
  modalPreviewLabel: {
    fontSize: 10.5,
    color: colors.light.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  modalPreviewValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalPreviewValText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalPreviewValTime: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  modalPreviewDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.light.borderDefault,
  },
  calendarContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    marginBottom: 6,
  },
  timeSection: {
    backgroundColor: colors.light.surface,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  presetContainer: {
    marginBottom: 8,
  },
  presetLabel: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  presetChipSelected: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  presetChipTextSelected: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 8,
    paddingVertical: 4,
  },
  timePickerCol: {
    alignItems: 'center',
  },
  timePickerColTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginBottom: 2,
  },
  timeColon: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.primaryDark,
    marginHorizontal: 8,
    marginTop: 14,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    color: colors.light.textSecondary,
    fontWeight: '600',
    fontSize: 13.5,
  },
  modalBtnConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnTextConfirm: {
    color: colors.light.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
  pickerAlertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 999,
    borderRadius: 24,
  },
  pickerAlertCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.light.surface,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pickerAlertCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pickerAlertIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pickerAlertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  pickerAlertMessage: {
    fontSize: 13.5,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  pickerAlertBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAlertBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.white,
  },
});
