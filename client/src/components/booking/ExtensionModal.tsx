import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { bookingService, Booking } from '../../services/bookingService';

interface ExtensionModalProps {
  visible: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSuccess: () => void;
}

const QUICK_DAY_OPTIONS = [1, 2, 3, 5, 7];

export function ExtensionModal({
  visible,
  onClose,
  booking,
  onSuccess,
}: ExtensionModalProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 24 : 16
  );
  const [additionalDays, setAdditionalDays] = useState(1);
  const [loading, setLoading] = useState(false);

  // Daily rate estimate
  const dailyRate = useMemo(() => {
    if (!booking) return 0;
    if (booking.pricePerDayAtBooking) return booking.pricePerDayAtBooking;
    if (booking.deviceId?.pricePerDay) return booking.deviceId.pricePerDay;
    if (booking.deviceId?.dailyRate) return booking.deviceId.dailyRate;
    if (booking.totalDays && booking.totalAmount) {
      return Math.round(booking.totalAmount / booking.totalDays);
    }
    return 100000;
  }, [booking]);

  // Current and new end dates
  const { currentEndDateStr, newEndDateStr, additionalFee } = useMemo(() => {
    if (!booking || !booking.endDate) {
      return { currentEndDateStr: '', newEndDateStr: '', additionalFee: 0 };
    }

    const currentEnd = new Date(booking.endDate);
    const newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    const fee = additionalDays * dailyRate;

    return {
      currentEndDateStr: currentEnd.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      newEndDateStr: newEnd.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      additionalFee: fee,
    };
  }, [booking, additionalDays, dailyRate]);

  const isPendingExtension = booking?.extensionRequest?.status === 'pending';

  const handleIncrement = () => {
    setAdditionalDays((prev: number) => Math.min(prev + 1, 30));
  };

  const handleDecrement = () => {
    setAdditionalDays((prev: number) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!booking) return;

    try {
      setLoading(true);
      await bookingService.requestExtension(booking._id, additionalDays);
      Alert.alert(
        STRINGS.EXTENSION_MODAL.REQUEST_SENT_TITLE,
        STRINGS.EXTENSION_MODAL.REQUEST_SENT_MSG(additionalDays),
        [
          {
            text: STRINGS.EXTENSION_MODAL.GOT_IT,
            onPress: () => {
              onClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      const msg = error.response?.data?.message || STRINGS.EXTENSION_MODAL.FAILED_MSG;
      Alert.alert(STRINGS.EXTENSION_MODAL.FAILED_TITLE, msg);
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: bottomInset + 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar" size={22} color={colors.light.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{STRINGS.EXTENSION_MODAL.TITLE}</Text>
              <Text style={styles.subtitle}>{STRINGS.EXTENSION_MODAL.ORDER_PREFIX}{booking.bookingCode}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {isPendingExtension ? (
            <View style={styles.pendingNotice}>
              <Ionicons name="time" size={28} color={colors.light.warning} />
              <Text style={styles.pendingTitle}>{STRINGS.EXTENSION_MODAL.PENDING_TITLE}</Text>
              <Text style={styles.pendingDesc}>
                {STRINGS.EXTENSION_MODAL.PENDING_DESC(booking.extensionRequest?.requestedDays || 0)}
              </Text>
              <TouchableOpacity style={styles.closeActionButton} onPress={onClose}>
                <Text style={styles.closeActionButtonText}>{STRINGS.EXTENSION_MODAL.GOT_IT}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Stepper chọn số ngày */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{STRINGS.EXTENSION_MODAL.SECTION_LABEL}</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, additionalDays <= 1 && styles.stepBtnDisabled]}
                    onPress={handleDecrement}
                    disabled={additionalDays <= 1}
                  >
                    <Ionicons name="remove" size={20} color={additionalDays <= 1 ? colors.light.textMuted : colors.light.textPrimary} />
                  </TouchableOpacity>

                  <View style={styles.stepValueBox}>
                    <Text style={styles.stepValueText}>+{additionalDays}</Text>
                    <Text style={styles.stepValueSub}>{STRINGS.EXTENSION_MODAL.DAYS_UNIT}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.stepBtn, additionalDays >= 30 && styles.stepBtnDisabled]}
                    onPress={handleIncrement}
                    disabled={additionalDays >= 30}
                  >
                    <Ionicons name="add" size={20} color={additionalDays >= 30 ? colors.light.textMuted : colors.light.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Quick Chips */}
                <View style={styles.chipsContainer}>
                  {QUICK_DAY_OPTIONS.map((days) => {
                    const isSelected = additionalDays === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setAdditionalDays(days)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.chipText, isSelected && styles.chipTextSelected]}
                          numberOfLines={1}
                        >
                          {STRINGS.EXTENSION_MODAL.DAYS_CHIP(days)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Preview Card */}
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{STRINGS.EXTENSION_MODAL.CURRENT_RETURN_LABEL}</Text>
                  <Text style={styles.previewValue}>{currentEndDateStr}</Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{STRINGS.EXTENSION_MODAL.NEW_RETURN_LABEL}</Text>
                  <Text style={[styles.previewValue, styles.previewHighlight]}>
                    {newEndDateStr}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{STRINGS.EXTENSION_MODAL.DAILY_RATE_LABEL}</Text>
                  <Text style={styles.previewValue}>
                    {dailyRate.toLocaleString('en-US')} {STRINGS.EXTENSION_MODAL.RATE_UNIT}
                  </Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewFeeLabel}>{STRINGS.EXTENSION_MODAL.ADDITIONAL_FEE_LABEL}</Text>
                  <Text style={styles.previewFeeValue}>
                    {STRINGS.EXTENSION_MODAL.FEE_PREFIX}{additionalFee.toLocaleString('en-US')} VND
                  </Text>
                </View>
              </View>

              <Text style={styles.noticeText}>
                {STRINGS.EXTENSION_MODAL.NOTICE_TEXT}
              </Text>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={loading}
                >
                  <Text style={styles.cancelBtnText}>{STRINGS.EXTENSION_MODAL.SKIP}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.light.white} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color={colors.light.white} />
                      <Text style={styles.confirmBtnText}>{STRINGS.EXTENSION_MODAL.CONFIRM}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepValueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: colors.light.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  stepValueText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  stepValueSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  chipsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: colors.light.white,
  },
  previewCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 20,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  previewLabel: {
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  previewHighlight: {
    color: colors.light.primary,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: 8,
  },
  previewFeeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  previewFeeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.light.primary,
  },
  noticeText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.light.primary,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
  pendingNotice: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  pendingDesc: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  closeActionButton: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeActionButtonText: {
    color: colors.light.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
