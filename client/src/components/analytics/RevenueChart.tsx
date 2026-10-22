import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { theme } from '../../theme/tokens';

export type RevenuePeriod = 'week' | 'month';

export interface RevenuePoint {
  label: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
  period: RevenuePeriod;
}

const formatRevenue = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value > 0) return `${Math.round(value / 1_000)}k`;
  return '0';
};

export function RevenueChart({ data, period }: RevenueChartProps) {
  const highestRevenue = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.caption}>
        {period === 'week'
          ? OWNER_STRINGS.ANALYTICS.DAILY_REVENUE
          : OWNER_STRINGS.ANALYTICS.WEEKLY_REVENUE}
      </Text>
      <View style={styles.chart}>
        {data.map((item) => {
          const height = item.revenue > 0
            ? Math.max((item.revenue / highestRevenue) * 112, 5)
            : 0;

          return (
            <View key={item.label} style={styles.column}>
              <Text style={styles.value} numberOfLines={1}>
                {formatRevenue(item.revenue)}
              </Text>
              <View style={styles.track}>
                <View style={[styles.bar, { height }]} />
              </View>
              <Text style={styles.axisLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  caption: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  chart: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  column: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  value: {
    width: '100%',
    textAlign: 'center',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.brand[800],
    marginBottom: theme.spacing.xs,
  },
  track: {
    width: '65%',
    height: 112,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.border.light,
    borderTopLeftRadius: theme.radii.sm,
    borderTopRightRadius: theme.radii.sm,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: theme.colors.brand[500],
    borderTopLeftRadius: theme.radii.sm,
    borderTopRightRadius: theme.radii.sm,
  },
  axisLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
});
