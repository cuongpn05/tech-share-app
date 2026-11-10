import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { STRINGS } from '../../../constants/strings';

interface PriceBreakdownCardProps {
  rentalDays?: number;
  totalHours?: number;
  dailyRate: number;
  depositValue: number;
}

export const PriceBreakdownCard = ({
  rentalDays,
  totalHours,
  dailyRate,
  depositValue,
}: PriceBreakdownCardProps) => {
  const hours = totalHours && totalHours > 0 ? totalHours : (rentalDays ? rentalDays * 24 : 0);
  if (hours <= 0) return null;

  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString('en-US') + ' VND';
  };

  // Tính tiền chính xác theo giờ: (giá ngày / 24h) * số giờ thuê thực tế
  const hourlyRate = dailyRate / 24;
  const baseRentalFee = Math.round(hourlyRate * hours);

  let longTermDiscountPercent = 0;
  // 72h = 3 ngày: 10%, 168h = 7 ngày: 20%
  if (hours >= 168) {
    longTermDiscountPercent = 20;
  } else if (hours >= 72) {
    longTermDiscountPercent = 10;
  }

  const longTermDiscountAmount = Math.round((baseRentalFee * longTermDiscountPercent) / 100);
  const rentalFeeAfterLongTerm = baseRentalFee - longTermDiscountAmount;
  const totalAmount = rentalFeeAfterLongTerm + depositValue;

  const getDurationLabel = () => {
    if (hours % 24 === 0) {
      const d = hours / 24;
      return `Base rental (${d} ${d === 1 ? 'day' : 'days'})`;
    }
    if (hours < 24) {
      return `Base rental (${hours} hours)`;
    }
    const d = Math.floor(hours / 24);
    const remH = hours % 24;
    return `Base rental (${d}d ${remH}h • ${hours}h)`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="receipt-outline" size={16} color={colors.light.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{STRINGS.PRICE_BREAKDOWN.TITLE}</Text>
          <Text style={styles.subtitle}>Transparent fees • No hidden charges</Text>
        </View>
      </View>

      {/* Rows */}
      <View style={styles.row}>
        <Text style={styles.label}>{getDurationLabel()}</Text>
        <Text style={styles.value}>{formatPrice(baseRentalFee)}</Text>
      </View>

      {longTermDiscountPercent > 0 && (
        <View style={styles.row}>
          <View style={styles.discountLabelRow}>
            <Ionicons name="sparkles" size={13} color={colors.light.success} />
            <Text style={styles.discountLabel}>
              {STRINGS.PRICE_BREAKDOWN.LONG_TERM_DISCOUNT(longTermDiscountPercent)}
            </Text>
          </View>
          <Text style={styles.discountValue}>
            - {formatPrice(longTermDiscountAmount)}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>{STRINGS.PRICE_BREAKDOWN.SECURITY_DEPOSIT}</Text>
        <Text style={styles.value}>{formatPrice(depositValue)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{STRINGS.PRICE_BREAKDOWN.SERVICE_FEE}</Text>
        <Text style={styles.freeServiceText}>{STRINGS.PRICE_BREAKDOWN.SERVICE_FEE_FREE}</Text>
      </View>

      <View style={styles.divider} />

      {/* Total row */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{STRINGS.PRICE_BREAKDOWN.TOTAL_PAYMENT}</Text>
        <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  label: {
    color: colors.light.textSecondary,
    fontSize: 13,
  },
  value: {
    color: colors.light.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
    textAlign: 'right',
  },
  discountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  discountLabel: {
    color: colors.light.success,
    fontSize: 13,
    fontWeight: '600',
  },
  discountValue: {
    color: colors.light.success,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  freeServiceText: {
    color: colors.light.success,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.borderDefault,
    marginVertical: 12,
    borderStyle: 'dashed',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.light.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.light.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
});
