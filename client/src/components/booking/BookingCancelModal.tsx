import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
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

export function BookingCancelModal({
  visible,
  bookingCode,
  isCancelling = false,
  onClose,
  onConfirm,
}: BookingCancelModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isCancelling) onClose();
      }}
    >
      <View style={styles.cancelModalOverlay}>
        <View style={styles.cancelModalCard}>
          <TouchableOpacity
            style={styles.cancelModalCloseBtn}
            onPress={onClose}
            disabled={isCancelling}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={colors.light.textSecondary} />
          </TouchableOpacity>

          <View style={styles.cancelModalIconRing}>
            <View style={styles.cancelModalIconCircle}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.light.white} />
            </View>
          </View>

          <Text style={styles.cancelModalTitle}>{STRINGS.BOOKING_DETAIL.CONFIRM_CANCEL_TITLE}</Text>
          <Text style={styles.cancelModalDesc}>
            {STRINGS.BOOKING_DETAIL.CONFIRM_CANCEL_MSG(bookingCode || '')}
          </Text>

          <View style={styles.cancelModalNoticeBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.light.warning} />
            <Text style={styles.cancelModalNoticeText}>
              The reservation slot will be released upon cancellation.
            </Text>
          </View>

          <View style={styles.cancelModalActionRow}>
            <TouchableOpacity
              style={styles.cancelModalKeepBtn}
              onPress={onClose}
              disabled={isCancelling}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelModalKeepBtnText}>{STRINGS.BOOKING_DETAIL.KEEP_BOOKING}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelModalConfirmBtn, isCancelling && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={isCancelling}
              activeOpacity={0.85}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.light.white} />
              ) : (
                <Text style={styles.cancelModalConfirmBtnText}>{STRINGS.BOOKING_DETAIL.CONFIRM_CANCEL_ACTION}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cancelModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.light.surface,
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  cancelModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.light.background,
  },
  cancelModalIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  cancelModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  cancelModalDesc: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  cancelModalNoticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.warningLight,
    borderWidth: 1,
    borderColor: colors.light.warningLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  cancelModalNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.textPrimary,
    lineHeight: 16,
  },
  cancelModalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelModalKeepBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalKeepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  cancelModalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelModalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.white,
  },
});
