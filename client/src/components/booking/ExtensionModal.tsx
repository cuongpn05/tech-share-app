import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
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

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setShowSuccessModal(true);
    } catch (error: any) {
      const msg = error.response?.data?.message || STRINGS.EXTENSION_MODAL.FAILED_MSG;
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: bottomInset + 16 }]}>
          {/* Top Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={colors.light.textSecondary} />
          </TouchableOpacity>

          {/* Header with Glowing Icon */}
          <View style={styles.header}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={24} color={colors.light.white} />
              </View>
            </View>
            <Text style={styles.title}>{STRINGS.EXTENSION_MODAL.TITLE}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>
                {STRINGS.EXTENSION_MODAL.ORDER_PREFIX}{booking.bookingCode}
              </Text>
            </View>
          </View>

          {isPendingExtension ? (
            <View style={styles.pendingNotice}>
              <View style={[styles.iconRing, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <View style={[styles.iconCircle, { backgroundColor: colors.light.warning }]}>
                  <Ionicons name="time" size={24} color={colors.light.white} />
                </View>
              </View>
              <Text style={styles.pendingTitle}>{STRINGS.EXTENSION_MODAL.PENDING_TITLE}</Text>
              <Text style={styles.pendingDesc}>
                {STRINGS.EXTENSION_MODAL.PENDING_DESC(booking.extensionRequest?.requestedDays || 0)}
              </Text>
              <TouchableOpacity style={styles.closeActionBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeActionBtnText}>{STRINGS.EXTENSION_MODAL.GOT_IT}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Extension days stepper */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{STRINGS.EXTENSION_MODAL.SECTION_LABEL}</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, additionalDays <= 1 && styles.stepBtnDisabled]}
                    onPress={handleDecrement}
                    disabled={additionalDays <= 1}
                    activeOpacity={0.7}
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
                    activeOpacity={0.7}
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
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>{STRINGS.EXTENSION_MODAL.SKIP}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.light.white} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={15} color={colors.light.white} />
                      <Text style={styles.confirmBtnText}>{STRINGS.EXTENSION_MODAL.CONFIRM}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── UNIFIED SUCCESS POPUP DIALOG (Soft UI Style) ── */}
        {showSuccessModal && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <TouchableOpacity
                style={styles.dialogCloseBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  onClose();
                  onSuccess();
                }}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.light.textMuted} />
              </TouchableOpacity>

              <View style={[styles.dialogIconCircle, { backgroundColor: colors.light.primaryLight }]}>
                <Ionicons name="checkmark-sharp" size={26} color={colors.light.primary} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.EXTENSION_MODAL.REQUEST_SENT_TITLE}</Text>
              <Text style={styles.dialogMessage}>
                {STRINGS.EXTENSION_MODAL.REQUEST_SENT_MSG(additionalDays)}
              </Text>

              <TouchableOpacity
                style={styles.dialogCtaBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  onClose();
                  onSuccess();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogCtaBtnText}>{STRINGS.EXTENSION_MODAL.GOT_IT}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── UNIFIED ERROR POPUP DIALOG (Soft UI Style) ── */}
        {Boolean(errorMessage) && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <TouchableOpacity
                style={styles.dialogCloseBtn}
                onPress={() => setErrorMessage(null)}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.light.textMuted} />
              </TouchableOpacity>

              <View style={[styles.dialogIconCircle, { backgroundColor: colors.light.dangerLight }]}>
                <Ionicons name="alert-circle-outline" size={26} color={colors.light.error} />
              </View>

              <Text style={styles.dialogTitle}>{STRINGS.EXTENSION_MODAL.FAILED_TITLE}</Text>
              <Text style={styles.dialogMessage}>{errorMessage}</Text>

              <TouchableOpacity
                style={[styles.dialogCtaBtn, { backgroundColor: colors.light.error }]}
                onPress={() => setErrorMessage(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogCtaBtnText}>{STRINGS.COMMON.OK}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: colors.light.background,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  codeBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  codeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.light.textSecondary,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepValueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: colors.light.primaryLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  stepValueText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  stepValueSub: {
    fontSize: 13,
    fontWeight: '700',
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
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.light.primaryLight,
    borderColor: colors.light.primary,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  previewLabel: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
  },
  previewValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  previewHighlight: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  previewFeeLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  previewFeeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  noticeText: {
    fontSize: 11.5,
    color: colors.light.textMuted,
    lineHeight: 16,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 9999,
    backgroundColor: colors.light.primary,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.white,
    letterSpacing: 0.3,
  },
  pendingNotice: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  pendingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginTop: 8,
    marginBottom: 6,
  },
  pendingDesc: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  closeActionBtn: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 28,
    height: 44,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionBtnText: {
    color: colors.light.white,
    fontWeight: '700',
    fontSize: 14,
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
    elevation: 30,
  },
  dialogCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dialogCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dialogIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 13.5,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  dialogCtaBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCtaBtnText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
