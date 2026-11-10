import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

export interface BookingResultModalProps {
  visible: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

/**
 * BookingResultModal
 *
 * Giao diện thông báo/cảnh báo tối giản theo hệ thống Soft-UI (đồng bộ với LogoutConfirmModal).
 * Phẳng, tinh gọn, thẻ bo tròn 20px, icon tròn 54px nhẹ nhàng, nút bấm 44px bo 12px.
 */
const BookingResultModal: React.FC<BookingResultModalProps> = ({
  visible,
  type = 'error',
  title,
  message,
  confirmText = 'OK',
  cancelText,
  onClose,
  onConfirm,
}) => {
  const getModalConfig = () => {
    switch (type) {
      case 'success':
        return {
          iconName: 'checkmark-outline' as const,
          iconColor: colors.light.primary,
          circleBg: colors.light.primaryLight,
          btnBg: colors.light.primary,
        };
      case 'warning':
        return {
          iconName: 'alert-circle-outline' as const,
          iconColor: colors.light.warning,
          circleBg: colors.light.warningLight,
          btnBg: colors.light.warning,
        };
      case 'info':
        return {
          iconName: 'information-circle-outline' as const,
          iconColor: colors.light.primary,
          circleBg: colors.light.primaryLight,
          btnBg: colors.light.primary,
        };
      case 'error':
      default:
        return {
          iconName: 'alert-circle-outline' as const,
          iconColor: colors.light.error,
          circleBg: colors.light.dangerLight,
          btnBg: colors.light.error,
        };
    }
  };

  const config = getModalConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard} accessibilityRole="alert">
          {/* Subtle top-right X close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={colors.light.textMuted} />
          </TouchableOpacity>

          {/* Single soft pastel circular icon */}
          <View style={[styles.iconCircle, { backgroundColor: config.circleBg }]}>
            <Ionicons
              name={config.iconName}
              size={26}
              color={config.iconColor}
            />
          </View>

          {/* Title & Description */}
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalDesc}>{message}</Text>

          {/* Clean Flat Action Buttons */}
          <View style={styles.actionRow}>
            {cancelText ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: config.btnBg },
                Boolean(cancelText) && { flex: 1 },
              ]}
              onPress={() => {
                if (onConfirm) {
                  onConfirm();
                } else {
                  onClose();
                }
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default BookingResultModal;

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
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.white,
  },
});
