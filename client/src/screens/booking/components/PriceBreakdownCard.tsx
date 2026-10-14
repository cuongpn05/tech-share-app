import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { STRINGS } from '../../../constants/strings';

interface PriceBreakdownCardProps {
  rentalDays: number;
  dailyRate: number;
  depositValue: number;
}

export const PriceBreakdownCard = ({
  rentalDays,
  dailyRate,
  depositValue,
}: PriceBreakdownCardProps) => {
  if (rentalDays <= 0) return null;

  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString('en-US') + ' VND';
  };

  const baseRentalFee = rentalDays * dailyRate;

  let longTermDiscountPercent = 0;
  if (rentalDays >= 7) {
    longTermDiscountPercent = 20;
  } else if (rentalDays >= 3) {
    longTermDiscountPercent = 10;
  }

  const longTermDiscountAmount = (baseRentalFee * longTermDiscountPercent) / 100;
  const rentalFeeAfterLongTerm = baseRentalFee - longTermDiscountAmount;
  const totalAmount = rentalFeeAfterLongTerm + depositValue;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.PRICE_BREAKDOWN.TITLE}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{STRINGS.PRICE_BREAKDOWN.BASE_RENTAL(rentalDays)}</Text>
        <Text style={styles.value}>{formatPrice(baseRentalFee)}</Text>
      </View>

      {longTermDiscountPercent > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, styles.discountLabel]}>
            {STRINGS.PRICE_BREAKDOWN.LONG_TERM_DISCOUNT(longTermDiscountPercent)}
          </Text>
          <Text style={[styles.value, styles.discountValue]}>
            - {formatPrice(longTermDiscountAmount)}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>{STRINGS.PRICE_BREAKDOWN.SECURITY_DEPOSIT}</Text>
        <Text style={styles.value}>{formatPrice(depositValue)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>{STRINGS.PRICE_BREAKDOWN.TOTAL_PAYMENT}</Text>
        <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: colors.light.textSecondary,
    fontSize: 14,
  },
  value: {
    color: colors.light.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  discountLabel: {
    color: colors.light.success,
  },
  discountValue: {
    color: colors.light.success,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: 12,
  },
  totalLabel: {
    color: colors.light.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.light.primary,
    fontSize: 18,
    fontWeight: '800',
  },
});
