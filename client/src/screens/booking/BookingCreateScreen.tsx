import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Alert,
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
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'error',
    title: '',
    message: '',
  });

  const showBookingResult = (
    type: 'success' | 'error',
    title: string,
    message: string
  ) => {
    setResultModal({ visible: true, type, title, message });
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

  const handleConfirmPicker = (date: Date) => {
    const now = new Date(Date.now() - 2 * 60 * 1000);

    if (pickerConfig.type === 'start') {
      if (date < now) {
        Alert.alert(STRINGS.BOOKING_CREATE.INVALID_TIME_TITLE, STRINGS.BOOKING_CREATE.PAST_TIME_MSG);
        return;
      }

      const conflict = isDateInBusyRange(date);
      if (conflict) {
        const fromStr = formatDateOnly(new Date(conflict.startDate));
        const toStr = formatDateOnly(new Date(conflict.endDate));
        Alert.alert(
          STRINGS.BOOKING_CREATE.DATES_UNAVAILABLE_TITLE,
          `The device is already booked (${fromStr} - ${toStr}). Please select a pickup date after ${toStr} or choose different dates!`
        );
        return;
      }

      if (endDate) {
        const rangeConflict = checkOverlapWithBusy(date, endDate);
        if (rangeConflict) {
          const fromStr = formatDateOnly(new Date(rangeConflict.startDate));
          const toStr = formatDateOnly(new Date(rangeConflict.endDate));
          Alert.alert(
            STRINGS.BOOKING_CREATE.SCHEDULE_CONFLICT_TITLE,
            `The selected date range conflicts with another booking (${fromStr} - ${toStr}). Return date has been reset.`
          );
          setEndDate(null);
        }
      }

      setStartDate(date);
      if (endDate && endDate < date) {
        setEndDate(null);
      }
    } else {
      if (startDate && date <= startDate) {
        Alert.alert(STRINGS.BOOKING_CREATE.INVALID_TIME_TITLE, STRINGS.BOOKING_CREATE.RETURN_BEFORE_PICKUP_MSG);
        return;
      }

      if (startDate) {
        const rangeConflict = checkOverlapWithBusy(startDate, date);
        if (rangeConflict) {
          const fromStr = formatDateOnly(new Date(rangeConflict.startDate));
          const toStr = formatDateOnly(new Date(rangeConflict.endDate));
          Alert.alert(
            STRINGS.BOOKING_CREATE.SCHEDULE_CONFLICT_TITLE,
            `The device is already booked between (${fromStr} - ${toStr}). Please select a return time before ${fromStr} or choose different dates!`
          );
          return;
        }
      }

      setEndDate(date);
    }
    setPickerConfig({ ...pickerConfig, visible: false });
  };

  const durationInfo = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalHours: 0, days: 0, hours: 0, billableDays: 0, displayText: '' };
    }
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    const totalHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const billableDays = Math.max(1, Math.ceil(totalHours / 24));

    let displayText = '';
    if (days > 0 && hours > 0) {
      displayText = `${days}d ${hours}h (${totalHours}h)`;
    } else if (days > 0) {
      displayText = `${days} ${days === 1 ? 'day' : 'days'} (${totalHours}h)`;
    } else {
      displayText = `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'}`;
    }

    return { totalHours, days, hours, billableDays, displayText };
  }, [startDate, endDate]);

  const calculateDays = () => durationInfo.billableDays;

  const handleQuickSelectDuration = (days: number) => {
    let base = startDate;
    if (!base) {
      base = new Date();
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
      setStartDate(base);
    }
    const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    const rangeConflict = checkOverlapWithBusy(base, newEnd);
    if (rangeConflict) {
      const fromStr = formatDateOnly(new Date(rangeConflict.startDate));
      const toStr = formatDateOnly(new Date(rangeConflict.endDate));
      Alert.alert(
        STRINGS.BOOKING_CREATE.SCHEDULE_CONFLICT_TITLE,
        `The device is already booked between (${fromStr} - ${toStr}). Please choose a different duration or select specific dates!`
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
  const baseRentalFee = rentalDays * deviceDailyRate;

  let longTermDiscountPercent = 0;
  if (rentalDays >= 7) longTermDiscountPercent = 20;
  else if (rentalDays >= 3) longTermDiscountPercent = 10;

  const longTermDiscountAmount = (baseRentalFee * longTermDiscountPercent) / 100;
  const rentalFeeAfterLongTerm = baseRentalFee - longTermDiscountAmount;
  const totalAmount = rentalFeeAfterLongTerm + deviceDepositValue;

  const handleConfirm = async () => {
    // 1. Check login if guest (Role Guest)
    if (!currentUser) {
      Alert.alert(
        STRINGS.AUTH_LOGIN_ALERT.TITLE,
        STRINGS.AUTH_LOGIN_ALERT.MSG,
        [
          { text: STRINGS.AUTH_LOGIN_ALERT.LATER, style: 'cancel' },
          {
            text: STRINGS.AUTH_LOGIN_ALERT.LOGIN_NOW,
            onPress: () => {
              if (onNavigateToLogin) onNavigateToLogin();
            },
          },
        ]
      );
      return;
    }

    if (currentUser?.role === 'renter' && !currentUser.isVerified) {
      Alert.alert(
        STRINGS.AUTH_VERIFY_ALERT.TITLE,
        STRINGS.AUTH_VERIFY_ALERT.MSG,
        [
          { text: STRINGS.AUTH_VERIFY_ALERT.LATER, style: 'cancel' },
          {
            text: STRINGS.AUTH_VERIFY_ALERT.VERIFY_NOW,
            onPress: onNavigateToVerification,
          },
        ]
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
        `The device is already booked between (${fromStr} - ${toStr}). Please select a different rental period!`
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
      });

      setSuccessModalVisible(true);
    } catch (error: any) {
      const responseData = error.response?.data;

      if (responseData?.code === 'RENTER_EKYC_REQUIRED') {
        Alert.alert(
          STRINGS.AUTH_VERIFY_ALERT.TITLE,
          responseData.message || STRINGS.AUTH_VERIFY_ALERT.MSG,
          [
            { text: STRINGS.AUTH_VERIFY_ALERT.LATER, style: 'cancel' },
            {
              text: STRINGS.AUTH_VERIFY_ALERT.VERIFY_NOW,
              onPress: onNavigateToVerification,
            },
          ]
        );
      } else {
        showBookingResult(
          'error',
          'Booking Failed',
          responseData?.message || 'Failed to submit booking request. Please try again later.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled =
    !startDate ||
    !endDate ||
    isSubmitting ||
    (deliveryMethod === 'delivery' && !deliveryAddress.trim());

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.BOOKING_CREATE.TITLE}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Device Summary */}
        <View style={styles.deviceCard}>
          <Image
            source={{ uri: device.images?.[0] || 'https://via.placeholder.com/150' }}
            style={styles.deviceThumb}
            resizeMode="cover"
          />
          <View style={styles.deviceInfo}>
            <View style={styles.deviceBadgeRow}>
              <Text style={styles.deviceBrand}>{device.brand}</Text>
              <Text style={styles.deviceCategoryBadge}>{device.category}</Text>
            </View>
            <Text style={styles.deviceTitle} numberOfLines={1}>
              {device.title || (device as any).name}
            </Text>
            <Text style={styles.dailyRate}>
              {formatPrice(deviceDailyRate)} <Text style={styles.dailyRateUnit}>/ day</Text>
            </Text>
          </View>
        </View>

        {/* Date Picker Section - Intuitive Rental Schedule (Select Rental Dates) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionHeaderIconBadge}>
                <Ionicons name="calendar-outline" size={16} color={colors.light.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>{STRINGS.BOOKING_CREATE.RENTAL_PERIOD}</Text>
                <Text style={styles.sectionSubtitle}>{STRINGS.BOOKING_CREATE.PICKUP_RETURN_SCHEDULE}</Text>
              </View>
            </View>
            {durationInfo.totalHours > 0 && startDate && endDate && (
              <View style={styles.durationPill}>
                <Ionicons name="time-outline" size={12} color={colors.light.primary} />
                <Text style={styles.durationPillText}>
                  {durationInfo.displayText}
                </Text>
              </View>
            )}
          </View>

          {/* Connected Step Cards */}
          <View style={styles.scheduleCardsWrapper}>
            {/* Step 1: Pickup */}
            <TouchableOpacity
              style={[
                styles.scheduleCard,
                startDate ? styles.scheduleCardActive : styles.scheduleCardEmpty,
              ]}
              onPress={() => openPicker('start')}
              activeOpacity={0.7}
            >
              <View style={styles.scheduleCardHeader}>
                <View style={styles.scheduleStepBadgeRow}>
                  <View style={[styles.stepDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.scheduleStepBadgeText, { color: '#047857' }]}>
                    {STRINGS.BOOKING_CREATE.STEP_PICKUP}
                  </Text>
                </View>
                <View style={startDate ? styles.scheduleActionBadgeActive : styles.scheduleActionBadgeEmpty}>
                  <Ionicons
                    name={startDate ? 'create-outline' : 'add-circle-outline'}
                    size={14}
                    color={startDate ? colors.light.primary : colors.light.white}
                  />
                  <Text style={startDate ? styles.scheduleActionTextActive : styles.scheduleActionTextEmpty}>
                    {startDate ? STRINGS.BOOKING_CREATE.CHANGE : STRINGS.BOOKING_CREATE.SELECT_DATE}
                  </Text>
                </View>
              </View>

              <View style={styles.scheduleCardBody}>
                <View style={[styles.scheduleIconCircle, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Ionicons name="log-in" size={20} color="#059669" />
                </View>
                <View style={styles.scheduleTextContent}>
                  {startDate ? (
                    <>
                      <Text style={styles.scheduleDateHero}>
                        {formatDateOnly(startDate)}{' '}
                        <Text style={styles.scheduleDayName}>({getDayOfWeekName(startDate)})</Text>
                      </Text>
                      <View style={styles.scheduleTimeRow}>
                        <Ionicons name="time-outline" size={13} color={colors.light.primary} />
                        <Text style={styles.scheduleTimeBadge}>
                          {STRINGS.BOOKING_CREATE.PICKUP_TIME_BADGE(formatTimeOnly(startDate))}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.schedulePlaceholderTitle}>
                        {STRINGS.BOOKING_CREATE.NO_PICKUP_SELECTED}
                      </Text>
                      <Text style={styles.schedulePlaceholderSub}>
                        {STRINGS.BOOKING_CREATE.TAP_TO_SELECT_PICKUP}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Timeline Connector & Duration */}
            <View style={styles.scheduleTimelineRow}>
              <View style={styles.scheduleTimelineLine} />
              {startDate && endDate && rentalDays > 0 ? (
                <View style={styles.scheduleDurationPill}>
                  <Ionicons name="timer-outline" size={14} color={colors.light.primary} />
                  <Text style={styles.scheduleDurationPillText}>
                    Total: <Text style={{ fontWeight: '800' }}>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</Text> ({rentalDays * 24} hrs)
                  </Text>
                </View>
              ) : (
                <View style={styles.scheduleArrowCircle}>
                  <Ionicons name="arrow-down" size={13} color={colors.light.textSecondary} />
                </View>
              )}
              <View style={styles.scheduleTimelineLine} />
            </View>

            {/* Step 2: Return */}
            <TouchableOpacity
              style={[
                styles.scheduleCard,
                endDate ? styles.scheduleCardActive : styles.scheduleCardEmpty,
              ]}
              onPress={() => openPicker('end')}
              activeOpacity={0.7}
            >
              <View style={styles.scheduleCardHeader}>
                <View style={styles.scheduleStepBadgeRow}>
                  <View style={[styles.stepDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.scheduleStepBadgeText, { color: '#B45309' }]}>
                    {STRINGS.BOOKING_CREATE.STEP_RETURN}
                  </Text>
                </View>
                <View style={endDate ? styles.scheduleActionBadgeActive : styles.scheduleActionBadgeEmpty}>
                  <Ionicons
                    name={endDate ? 'create-outline' : 'add-circle-outline'}
                    size={14}
                    color={endDate ? colors.light.primary : colors.light.white}
                  />
                  <Text style={endDate ? styles.scheduleActionTextActive : styles.scheduleActionTextEmpty}>
                    {endDate ? STRINGS.BOOKING_CREATE.CHANGE : STRINGS.BOOKING_CREATE.SELECT_DATE}
                  </Text>
                </View>
              </View>

              <View style={styles.scheduleCardBody}>
                <View style={[styles.scheduleIconCircle, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Ionicons name="log-out" size={20} color="#D97706" />
                </View>
                <View style={styles.scheduleTextContent}>
                  {endDate ? (
                    <>
                      <Text style={styles.scheduleDateHero}>
                        {formatDateOnly(endDate)}{' '}
                        <Text style={styles.scheduleDayName}>({getDayOfWeekName(endDate)})</Text>
                      </Text>
                      <View style={styles.scheduleTimeRow}>
                        <Ionicons name="time-outline" size={13} color="#D97706" />
                        <Text style={[styles.scheduleTimeBadge, { color: '#B45309' }]}>
                          {STRINGS.BOOKING_CREATE.RETURN_TIME_BADGE(formatTimeOnly(endDate))}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.schedulePlaceholderTitle}>
                        {STRINGS.BOOKING_CREATE.NO_RETURN_SELECTED}
                      </Text>
                      <Text style={styles.schedulePlaceholderSub}>
                        {startDate
                          ? STRINGS.BOOKING_CREATE.CHOOSE_RETURN_TIME
                          : STRINGS.BOOKING_CREATE.SELECT_PICKUP_FIRST}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick Duration Shortcuts */}
          <View style={styles.quickDurationBox}>
            <View style={styles.quickDurationHeader}>
              <Ionicons name="flash-outline" size={13} color={colors.light.primary} />
              <Text style={styles.quickDurationTitle}>{STRINGS.BOOKING_CREATE.QUICK_DURATION_TITLE}</Text>
            </View>
            <View style={styles.quickChipsRow}>
              {[
                { days: 1, label: '1 day' },
                { days: 2, label: '2 days' },
                { days: 3, label: '3 days' },
                { days: 5, label: '5 days' },
                { days: 7, label: '1 week' },
              ].map((item) => {
                const isSelected = rentalDays === item.days && endDate !== null;
                return (
                  <TouchableOpacity
                    key={item.days}
                    style={[styles.quickChip, isSelected && styles.quickChipSelected]}
                    onPress={() => handleQuickSelectDuration(item.days)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.quickChipText, isSelected && styles.quickChipTextSelected]}
                    >
                      +{item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Delivery Method Section ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{STRINGS.BOOKING_CREATE.DELIVERY_METHOD_TITLE}</Text>

          <View style={styles.deliveryOptionsContainer}>
            {/* Option 1: Pickup */}
            <TouchableOpacity
              style={[
                styles.deliveryOptionCard,
                deliveryMethod === 'pickup' && styles.deliveryOptionCardSelected,
              ]}
              onPress={() => setDeliveryMethod('pickup')}
              activeOpacity={0.7}
            >
              <View style={styles.deliveryOptionHeader}>
                <View style={styles.deliveryIconTitleRow}>
                  <View
                    style={[
                      styles.deliveryIconBox,
                      deliveryMethod === 'pickup' && styles.deliveryIconBoxSelected,
                    ]}
                  >
                    <Ionicons
                      name="storefront-outline"
                      size={20}
                      color={deliveryMethod === 'pickup' ? colors.light.primary : colors.light.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.deliveryOptionTitle,
                        deliveryMethod === 'pickup' && styles.deliveryOptionTitleSelected,
                      ]}
                    >
                      {STRINGS.BOOKING_CREATE.METHOD_PICKUP}
                    </Text>
                    <Text style={styles.deliveryOptionSubtitle}>
                      {STRINGS.BOOKING_CREATE.METHOD_PICKUP_SUB}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    deliveryMethod === 'pickup' && styles.radioCircleSelected,
                  ]}
                >
                  {deliveryMethod === 'pickup' && <View style={styles.radioInnerCircle} />}
                </View>
              </View>

              {deliveryMethod === 'pickup' && (
                <View style={styles.pickupAddressBox}>
                  <Ionicons name="location-outline" size={16} color={colors.light.primary} />
                  <Text style={styles.pickupAddressText}>
                    {STRINGS.BOOKING_CREATE.PICKUP_ADDRESS_LABEL}{' '}
                    {device.addressText || device.location?.address || STRINGS.BOOKING_CREATE.METHOD_PICKUP_FALLBACK}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Option 2: Delivery */}
            <TouchableOpacity
              style={[
                styles.deliveryOptionCard,
                deliveryMethod === 'delivery' && styles.deliveryOptionCardSelected,
              ]}
              onPress={() => setDeliveryMethod('delivery')}
              activeOpacity={0.7}
            >
              <View style={styles.deliveryOptionHeader}>
                <View style={styles.deliveryIconTitleRow}>
                  <View
                    style={[
                      styles.deliveryIconBox,
                      deliveryMethod === 'delivery' && styles.deliveryIconBoxSelected,
                    ]}
                  >
                    <Ionicons
                      name="bicycle-outline"
                      size={20}
                      color={deliveryMethod === 'delivery' ? colors.light.primary : colors.light.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.deliveryOptionTitle,
                        deliveryMethod === 'delivery' && styles.deliveryOptionTitleSelected,
                      ]}
                    >
                      {STRINGS.BOOKING_CREATE.METHOD_DELIVERY}
                    </Text>
                    <Text style={styles.deliveryOptionSubtitle}>
                      {STRINGS.BOOKING_CREATE.METHOD_DELIVERY_SUB}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    deliveryMethod === 'delivery' && styles.radioCircleSelected,
                  ]}
                >
                  {deliveryMethod === 'delivery' && <View style={styles.radioInnerCircle} />}
                </View>
              </View>

              {deliveryMethod === 'delivery' && (
                <View style={styles.deliveryInputBox}>
                  <Text style={styles.deliveryInputLabel}>
                    {STRINGS.BOOKING_CREATE.DELIVERY_ADDRESS_LABEL} <Text style={{ color: colors.light.error }}>*</Text>:
                  </Text>
                  <View style={styles.deliveryInputWrapper}>
                    <Ionicons name="location" size={18} color={colors.light.primary} style={{ marginTop: 2 }} />
                    <TextInput
                      style={styles.deliveryAddressInput}
                      placeholder={STRINGS.BOOKING_CREATE.DELIVERY_ADDRESS_PLACEHOLDER}
                      placeholderTextColor={colors.light.textSecondary}
                      value={deliveryAddress}
                      onChangeText={(text: string) => setDeliveryAddress(text)}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {rentalDays > 0 && (
          <PriceBreakdownCard
            rentalDays={rentalDays}
            dailyRate={deviceDailyRate}
            depositValue={deviceDepositValue}
          />
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 10 }]}>
        <View>
          <Text style={styles.bottomPriceSub}>{STRINGS.BOOKING_CREATE.TOTAL_PAYMENT}</Text>
          <Text style={styles.bottomPriceMain}>
            {rentalDays > 0 ? formatPrice(totalAmount) : '---'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, isConfirmDisabled && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={isConfirmDisabled}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.light.white} />
          ) : (
            <Text style={[styles.confirmBtnText, isConfirmDisabled && styles.confirmBtnTextDisabled]}>
              {STRINGS.BOOKING_CREATE.CONFIRM_BOOKING}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <CustomDateTimePicker
        visible={pickerConfig.visible}
        type={pickerConfig.type}
        initialDate={pickerConfig.type === 'start' ? startDate : endDate}
        minDate={pickerConfig.type === 'end' ? startDate : new Date()}
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
    if (visible && scrollViewRef.current) {
      const targetIndex = items.indexOf(selectedValue);
      if (targetIndex >= 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: targetIndex * ITEM_HEIGHT, animated: false });
        }, 50);
      }
    }
  }, [visible, items, selectedValue]);

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    const actualItem = items[index];
    if (actualItem && actualItem !== selectedValue) {
      onValueChange(actualItem);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 70 }}>
      {/* Selection Highlight */}
      <View
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT,
          width: '100%',
          height: ITEM_HEIGHT,
          backgroundColor: colors.light.primaryLight,
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: colors.light.primary,
        }}
        pointerEvents="none"
      />

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollView
          ref={scrollViewRef}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        >
          {items.map((item: string) => {
            const isSelected = item === selectedValue;
            return (
              <View key={item} style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: isSelected ? 22 : 15,
                    color: isSelected ? colors.light.primary : colors.light.textSecondary,
                    fontWeight: isSelected ? '800' : '500',
                  }}
                >
                  {item}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
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

  useEffect(() => {
    if (visible) {
      const d = initialDate || new Date();
      setDate(d);
      setHours(d.getHours().toString().padStart(2, '0'));
      setMinutes(d.getMinutes().toString().padStart(2, '0'));
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
      Alert.alert(
        STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_TITLE,
        STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_MSG
      );
      return;
    }

    onConfirm(finalDate);
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
                    : STRINGS.BOOKING_CREATE.RETURN_TIME_SUB}
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
                    Alert.alert(
                      STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_TITLE,
                      STRINGS.BOOKING_CREATE.DATE_UNAVAILABLE_MSG
                    );
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

            {/* Calendar Legend */}
            <View style={styles.calendarLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.light.primary }]} />
                <Text style={styles.legendText}>{STRINGS.BOOKING_CREATE.SELECTED_DATE}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.light.error }]} />
                <Text style={styles.legendText}>{STRINGS.BOOKING_CREATE.ALREADY_BOOKED}</Text>
              </View>
            </View>

            {/* Time Picker Section */}
            <View style={styles.timeSection}>
              <View style={styles.timeSectionHeaderRow}>
                <Ionicons name="time-outline" size={16} color={colors.light.primary} />
                <Text style={styles.timeSectionTitle}>
                  {type === 'start'
                    ? STRINGS.BOOKING_CREATE.PICKUP_TIME_TITLE
                    : STRINGS.BOOKING_CREATE.RETURN_TIME_TITLE}
                </Text>
              </View>

              {/* Quick Preset Buttons */}
              <View style={styles.presetContainer}>
                <Text style={styles.presetLabel}>{STRINGS.BOOKING_CREATE.TIME_SUGGESTIONS}</Text>
                <View style={styles.presetChipsRow}>
                  {quickTimePresets.map((preset) => {
                    const [h, m] = preset.split(':');
                    const isSelected = hours === h && minutes === m;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetChip,
                          isSelected ? styles.presetChipSelected : undefined,
                        ]}
                        onPress={() => {
                          setHours(h);
                          setMinutes(m);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            isSelected ? styles.presetChipTextSelected : undefined,
                          ]}
                        >
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
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light.background,
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
    borderRadius: 10,
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
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 14,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  scrollContent: {
    paddingBottom: 110,
    paddingTop: 14,
  },
  deviceCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.light.borderSubtle,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deviceBrand: {
    color: colors.light.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deviceCategoryBadge: {
    fontSize: 11,
    color: colors.light.textSecondary,
    backgroundColor: colors.light.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
    fontWeight: '500',
  },
  deviceTitle: {
    color: colors.light.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  dailyRate: {
    color: colors.light.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  dailyRateUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.light.textSecondary,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeaderIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  scheduleCardsWrapper: {
    gap: 0,
    marginTop: 4,
  },
  scheduleCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  scheduleCardActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.surface,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scheduleCardEmpty: {
    borderColor: colors.light.border,
    backgroundColor: colors.light.borderSubtle + '25',
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scheduleStepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  scheduleStepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scheduleActionBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.light.primaryLight,
  },
  scheduleActionTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primary,
  },
  scheduleActionBadgeEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.light.primary,
  },
  scheduleActionTextEmpty: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.white,
  },
  scheduleCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scheduleTextContent: {
    flex: 1,
  },
  scheduleDateHero: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 3,
  },
  scheduleDayName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleTimeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.primary,
  },
  schedulePlaceholderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  schedulePlaceholderSub: {
    fontSize: 11,
    color: colors.light.textSecondary,
    lineHeight: 15,
  },
  scheduleTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  scheduleTimelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.light.border,
  },
  scheduleDurationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
    marginHorizontal: 8,
  },
  scheduleDurationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primary,
  },
  scheduleArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
    marginHorizontal: 8,
  },
  quickDurationBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  quickDurationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  quickDurationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  quickChipSelected: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  quickChipTextSelected: {
    color: colors.light.white,
    fontWeight: '700',
  },
  deliveryOptionsContainer: {
    gap: 12,
  },
  deliveryOptionCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    padding: 14,
  },
  deliveryOptionCardSelected: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.primaryLight,
  },
  deliveryOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliveryIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  deliveryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  deliveryIconBoxSelected: {
    borderColor: colors.light.primaryLight,
    backgroundColor: colors.light.primaryLight + '60',
  },
  deliveryOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  deliveryOptionTitleSelected: {
    color: colors.light.primary,
  },
  deliveryOptionSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
  },
  radioCircleSelected: {
    borderColor: colors.light.primary,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.light.primary,
  },
  pickupAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.surface,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  pickupAddressText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  deliveryInputBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  deliveryInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 6,
  },
  deliveryInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.light.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  deliveryAddressInput: {
    flex: 1,
    fontSize: 13,
    color: colors.light.textPrimary,
    minHeight: 40,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 6,
  },
  bottomPriceSub: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  bottomPriceMain: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.primary,
  },
  confirmBtn: {
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.light.borderDefault,
  },
  confirmBtnText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtnTextDisabled: {
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
    borderRadius: 20,
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
    borderBottomColor: colors.light.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
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
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  modalScrollBody: {
    flexGrow: 0,
  },
  modalPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  modalPreviewCol: {
    flex: 1,
    alignItems: 'center',
  },
  modalPreviewLabel: {
    fontSize: 11,
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalPreviewValTime: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.primary,
  },
  modalPreviewDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.light.borderDefault,
  },
  calendarContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 6,
  },
  calendarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  timeSection: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  timeSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timeSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  presetContainer: {
    marginBottom: 10,
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  presetChipSelected: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  presetChipTextSelected: {
    color: colors.light.white,
    fontWeight: '700',
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  timePickerCol: {
    alignItems: 'center',
  },
  timePickerColTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginBottom: 4,
  },
  timeColon: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.light.primary,
    marginHorizontal: 10,
    marginTop: 16,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    color: colors.light.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  modalBtnConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalBtnTextConfirm: {
    color: colors.light.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
