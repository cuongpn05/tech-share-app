import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

export interface BookingCancelModalProps {
  visible: boolean;
  bookingCode?: string;
  isCancelling?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * BookingCancelModal
 *
 * Giao diện xác nhận huỷ đặt thiết bị đồng bộ tối giản theo phong cách Soft-UI (tương tự LogoutConfirmModal).
 * Phẳng, tinh gọn, không đổ bóng nặng, không vành kép rườm rà.
 */
export function BookingCancelModal({
  visible,
  bookingCode,
  isCancelling = false,
  onClose,
  onConfirm,
}: BookingCancelModalProps) {
  const handleClose = () => {
    if (!isCancelling) {
      onClose();
    }
  };

  const message = bookingCode
    ? `Are you sure you want to cancel booking #${bookingCode}?`
    : 'Are you sure you want to cancel this booking?';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleClose} disabled={isCancelling}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard} accessibilityRole="alert">
          {/* Subtle top-right X close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={isCancelling}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={STRINGS.COMMON.CLOSE}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={colors.light.textMuted} />
          </TouchableOpacity>

          {/* Single soft pastel danger circle */}
          <View style={styles.iconCircle}>
            <Ionicons
              name="alert-circle-outline"
              size={26}
              color={colors.light.error}
            />
          </View>

          {/* Title & Description */}
          <Text style={styles.modalTitle}>Confirm Cancellation</Text>
          <Text style={styles.modalDesc}>{message}</Text>

          {/* Clean Flat Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={isCancelling}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{STRINGS.BOOKING_DETAIL.KEEP_BOOKING || 'Keep Booking'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isCancelling && styles.confirmBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={isCancelling}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.light.white} />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {STRINGS.BOOKING_DETAIL.CONFIRM_CANCEL_ACTION || 'Confirm Cancel'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
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
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13.5,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.white,
  },
});

