import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
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
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={colors.light.textSecondary} />
          </TouchableOpacity>

          {/* Success Brand Icon Badge */}
          <View style={styles.iconOuterRing}>
            <View style={styles.iconInnerCircle}>
              <Ionicons name="checkmark-sharp" size={28} color={colors.light.white} />
            </View>
          </View>

          {/* Header Texts */}
          <Text style={styles.title}>Booking Submitted!</Text>
          <Text style={styles.subtitle}>
            Your rental request has been sent to the owner. You will receive an update once it is confirmed.
          </Text>

          {/* Summary Details Box */}
          <View style={styles.summaryBox}>
            {deviceTitle ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.light.primary} />
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
                  <Ionicons name="calendar-outline" size={16} color={colors.light.primary} />
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
                  <Ionicons name="wallet-outline" size={16} color={colors.light.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryLabel}>Estimated Total</Text>
                  <Text style={styles.summaryPriceValue}>{formatPrice(totalAmount)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onViewBookings}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>View My Bookings</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.light.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.light.surface,
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 20,
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
  closeBtn: {
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
  iconOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.light.primaryBg,
  },
  iconInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: colors.light.primaryBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.primaryLight,
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
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.primaryLight,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  summaryPriceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.light.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  primaryBtnText: {
    color: colors.light.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
});
