import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { STRINGS } from '../../constants/strings';

export interface EkycModalSummaryItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export type EkycModalTone = 'brand' | 'success' | 'warning' | 'danger';

const TONE_CONFIG: Record<
  EkycModalTone,
  {
    outerBg: string;
    outerBorder: string;
    innerBg: string;
    accentColor: string;
    summaryBg: string;
    summaryBorder: string;
    summaryIconBorder: string;
  }
> = {
  brand: {
    outerBg: theme.colors.brand[100],
    outerBorder: theme.colors.brand[50],
    innerBg: theme.colors.brand[500],
    accentColor: theme.colors.brand[500],
    summaryBg: theme.colors.brand[50],
    summaryBorder: theme.colors.brand[100],
    summaryIconBorder: theme.colors.brand[100],
  },
  success: {
    outerBg: '#D1FAE5',
    outerBorder: theme.colors.greenLight,
    innerBg: theme.colors.green,
    accentColor: theme.colors.brand[500],
    summaryBg: theme.colors.brand[50],
    summaryBorder: theme.colors.brand[100],
    summaryIconBorder: theme.colors.brand[100],
  },
  warning: {
    outerBg: theme.colors.amberLight,
    outerBorder: '#FFFBEB',
    innerBg: theme.colors.amber,
    accentColor: theme.colors.amber,
    summaryBg: '#FFFBEB',
    summaryBorder: theme.colors.amberLight,
    summaryIconBorder: theme.colors.amberLight,
  },
  danger: {
    outerBg: '#FEE2E2',
    outerBorder: theme.colors.redLight,
    innerBg: theme.colors.red,
    accentColor: theme.colors.red,
    summaryBg: theme.colors.redLight,
    summaryBorder: '#FECACA',
    summaryIconBorder: '#FECACA',
  },
};

function EkycModalSummaryBox({
  items,
  tone,
}: {
  items: EkycModalSummaryItem[];
  tone: EkycModalTone;
}) {
  if (!items || items.length === 0) return null;
  const cfg = TONE_CONFIG[tone];

  return (
    <View
      style={[
        styles.summaryBox,
        { backgroundColor: cfg.summaryBg, borderColor: cfg.summaryBorder },
      ]}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <View
            key={`${item.label}_${idx}`}
            style={[
              styles.summaryRow,
              { borderBottomColor: cfg.summaryBorder },
              isLast && styles.summaryRowLast,
            ]}
          >
            <View
              style={[
                styles.summaryIconWrap,
                { borderColor: cfg.summaryIconBorder },
              ]}
            >
              <Ionicons name={item.icon} size={16} color={cfg.accentColor} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export interface EkycConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: EkycModalTone;
  summaryItems?: EkycModalSummaryItem[];
  noticeText?: string;
  confirmText: string;
  cancelText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Modal xác nhận đồng bộ Soft-UI cho các thao tác gửi đơn eKYC và duyệt eKYC (Renter & Owner).
 */
export function EkycConfirmModal({
  visible,
  title,
  message,
  icon = 'shield-checkmark-outline',
  tone = 'brand',
  summaryItems = [],
  noticeText = '',
  confirmText,
  cancelText = STRINGS.COMMON.CANCEL,
  loading = false,
  onCancel,
  onConfirm,
}: EkycConfirmModalProps) {
  const cfg = TONE_CONFIG[tone];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onCancel} disabled={loading}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.card} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View
            style={[
              styles.iconOuterRing,
              { backgroundColor: cfg.outerBg, borderColor: cfg.outerBorder },
            ]}
          >
            <View style={[styles.iconInnerCircle, { backgroundColor: cfg.innerBg }]}>
              <Ionicons name={icon} size={26} color={theme.colors.white} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <EkycModalSummaryBox items={summaryItems} tone={tone} />

          {Boolean(noticeText) && (
            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={theme.colors.text.muted}
              />
              <Text style={styles.noticeText}>{noticeText}</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: cfg.innerBg },
                loading && styles.btnDisabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
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

export type EkycResultType = 'success' | 'error' | 'warning' | 'info' | 'rejected';

export interface EkycResultModalProps {
  visible: boolean;
  type: EkycResultType;
  title: string;
  message: string;
  summaryItems?: EkycModalSummaryItem[];
  buttonText?: string;
  onClose: () => void;
}

/**
 * Modal thông báo kết quả (gửi đơn thành công / duyệt thành công / từ chối / lỗi)
 * theo thiết kế Soft-UI đồng bộ với BookingSuccessModal và LogoutConfirmModal.
 */
export function EkycResultModal({
  visible,
  type,
  title,
  message,
  summaryItems = [],
  buttonText = STRINGS.EKYC.SUBMIT_SUCCESS_ACK,
  onClose,
}: EkycResultModalProps) {
  const tone: EkycModalTone =
    type === 'success'
      ? 'success'
      : type === 'error' || type === 'rejected'
      ? 'danger'
      : type === 'warning'
      ? 'warning'
      : 'brand';

  const iconName: keyof typeof Ionicons.glyphMap =
    type === 'success'
      ? 'checkmark-sharp'
      : type === 'error'
      ? 'alert-outline'
      : type === 'rejected' || type === 'warning'
      ? 'close-circle-outline'
      : 'information';

  const cfg = TONE_CONFIG[tone];
  const primaryButtonColor =
    type === 'error' || type === 'rejected'
      ? theme.colors.red
      : type === 'warning'
      ? theme.colors.amber
      : theme.colors.brand[500];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.card} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View
            style={[
              styles.iconOuterRing,
              { backgroundColor: cfg.outerBg, borderColor: cfg.outerBorder },
            ]}
          >
            <View style={[styles.iconInnerCircle, { backgroundColor: cfg.innerBg }]}>
              <Ionicons name={iconName} size={28} color={theme.colors.white} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <EkycModalSummaryBox items={summaryItems} tone={tone} />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: primaryButtonColor }]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii['2xl'],
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.cardHover,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
  },
  iconInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  summaryBox: {
    width: '100%',
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  noticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text.muted,
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
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.white,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default {
  EkycConfirmModal,
  EkycResultModal,
};

