import React, { useState, useEffect } from 'react';
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
import {
  registerLogoutModalListener,
  logoutUser,
  LogoutModalConfig,
} from '../../services/logoutService';
import { useAppDispatch } from '../../store';

export interface LogoutConfirmModalProps {
  visible?: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  noticeText?: string;
  isLoggingOut?: boolean;
  onClose?: () => void;
  onConfirm?: () => Promise<void> | void;
}

/**
 * LogoutConfirmModal
 *
 * Giao diện xác nhận đăng xuất đơn giản, tinh gọn và phẳng theo Soft-UI Design System của TechShare.
 * Hạn chế tối đa đổ bóng nặng, giao diện nhẹ nhàng, thanh thoát và đồng bộ với toàn hệ thống.
 */
export function LogoutConfirmModal({
  visible: propVisible,
  title: propTitle,
  message: propMessage,
  confirmText: propConfirmText,
  cancelText: propCancelText,
  noticeText: propNoticeText,
  isLoggingOut: propIsLoggingOut,
  onClose: propOnClose,
  onConfirm: propOnConfirm,
}: LogoutConfirmModalProps) {
  const dispatch = useAppDispatch();
  const [globalConfig, setGlobalConfig] = useState<LogoutModalConfig | null>(null);
  const [globalIsLoggingOut, setGlobalIsLoggingOut] = useState(false);

  useEffect(() => {
    if (propVisible !== undefined) {
      return;
    }

    const unsubscribe = registerLogoutModalListener((config) => {
      setGlobalConfig(config);
    });

    return unsubscribe;
  }, [propVisible]);

  const isControlled = propVisible !== undefined;
  const isVisible = isControlled ? Boolean(propVisible) : Boolean(globalConfig?.isOpen);
  const isSubmitting = isControlled ? Boolean(propIsLoggingOut) : globalIsLoggingOut;

  const title =
    (isControlled ? propTitle : globalConfig?.title) ||
    STRINGS.LOGOUT_MODAL.DEFAULT_TITLE;

  const message =
    (isControlled ? propMessage : globalConfig?.message) ||
    STRINGS.LOGOUT_MODAL.DEFAULT_SUBTITLE;

  const confirmText =
    (isControlled ? propConfirmText : globalConfig?.confirmText) ||
    STRINGS.LOGOUT_MODAL.DEFAULT_CONFIRM;

  const cancelText =
    (isControlled ? propCancelText : globalConfig?.cancelText) ||
    STRINGS.LOGOUT_MODAL.DEFAULT_CANCEL;

  const noticeText =
    (isControlled ? propNoticeText : globalConfig?.noticeText) ?? '';

  const handleClose = () => {
    if (isSubmitting) return;

    if (isControlled) {
      propOnClose?.();
    } else {
      setGlobalConfig(null);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (isControlled) {
      if (propOnConfirm) {
        await propOnConfirm();
      }
      return;
    }

    setGlobalIsLoggingOut(true);
    try {
      if (globalConfig?.onBeforeLogout) {
        globalConfig.onBeforeLogout();
      }

      await logoutUser(globalConfig?.dispatch || dispatch);

      if (globalConfig?.onAfterLogout) {
        globalConfig.onAfterLogout();
      }
    } catch (err) {
      console.warn('[LogoutConfirmModal] Lỗi thực hiện đăng xuất:', err);
    } finally {
      setGlobalIsLoggingOut(false);
      setGlobalConfig(null);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleClose} disabled={isSubmitting}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View
          style={styles.modalCard}
          accessibilityRole="alert"
        >
          {/* Nút đóng góc trên phải */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={isSubmitting}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={STRINGS.LOGOUT_MODAL.CLOSE_ACCESSIBILITY}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={colors.light.textMuted} />
          </TouchableOpacity>

          {/* Icon tinh gọn, phẳng, không bóng đổ */}
          <View style={styles.iconCircle}>
            <Ionicons
              name="log-out-outline"
              size={26}
              color={colors.light.error}
              style={styles.iconShift}
            />
          </View>

          {/* Tiêu đề & Thông điệp */}
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalDesc}>{message}</Text>

          {/* Khung ghi chú nhẹ nếu có */}
          {Boolean(noticeText) && (
            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.light.textSecondary}
              />
              <Text style={styles.noticeText}>{noticeText}</Text>
            </View>
          )}

          {/* Hàng nút bấm phẳng, tối giản */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={isSubmitting}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isSubmitting && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.light.white} />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default LogoutConfirmModal;

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
    // Đổ bóng siêu nhẹ, tự nhiên
    shadowColor: colors.light.shadow,
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
  iconShift: {
    marginLeft: 2,
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
  noticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
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
