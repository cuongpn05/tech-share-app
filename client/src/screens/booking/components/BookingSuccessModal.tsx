import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

interface BookingSuccessModalProps {
  visible: boolean;
  deviceTitle?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  rentalDays?: number;
  totalAmount?: number;
  onViewBookings: () => void;
  onClose: () => void;
}

const formatDate = (d?: Date | null) => {
  if (!d) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatPrice = (price?: number) => {
  if (!price) return '0 VND';
  return Math.round(price).toLocaleString('en-US') + ' VND';
};

export function BookingSuccessModal({
  visible,
  deviceTitle,
  startDate,
  endDate,
  rentalDays = 1,
  totalAmount = 0,
  onViewBookings,
  onClose,
}: BookingSuccessModalProps) {
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

          {/* Single soft pastel primary circle */}
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-sharp" size={26} color={colors.light.primary} />
          </View>

          {/* Header Title */}
          <Text style={styles.title}>Booking Submitted!</Text>

          {/* Summary Details Box */}
          <View style={styles.summaryBox}>
            {deviceTitle ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="phone-portrait-outline" size={15} color={colors.light.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryLabel}>Device</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{deviceTitle}</Text>
                </View>
              </View>
            ) : null}

            {startDate && endDate ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="calendar-outline" size={15} color={colors.light.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryLabel}>Rental Period</Text>
                  <Text style={styles.summaryValue}>
                    {rentalDays} {rentalDays === 1 ? 'day' : 'days'} ({formatDate(startDate)} - {formatDate(endDate)})
                  </Text>
                </View>
              </View>
            ) : null}

            {totalAmount > 0 ? (
              <View style={[styles.summaryRow, styles.summaryRowLast]}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="wallet-outline" size={15} color={colors.light.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryLabel}>Estimated Total</Text>
                  <Text style={styles.summaryPriceValue}>{formatPrice(totalAmount)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onViewBookings}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>View My Bookings</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.light.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
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
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 14,
    textAlign: 'center',
  },
  summaryBox: {
    width: '100%',
    backgroundColor: colors.light.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.textSecondary,
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  summaryPriceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  actionCol: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtn: {
    width: '100%',
    height: 44,
    backgroundColor: colors.light.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
});
