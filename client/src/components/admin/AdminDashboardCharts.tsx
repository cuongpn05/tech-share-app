import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { ADMIN_STRINGS } from '../../constants/adminStrings';
import { DashboardBookingStatus, DashboardCategory, RentalVolumePoint } from '../../services/adminService';
import { colors, ThemeColors } from '../../theme/colors';
import { theme } from '../../theme/tokens';

const strings = ADMIN_STRINGS.DASHBOARD;
const { spacing, radii, typography } = theme;
const numberFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
export const formatCount = (value: number) => numberFormat.format(value);
export const formatCompact = (value: number) => compactFormat.format(value);
export const formatVnd = (value: number) => formatCount(value) + ' ' + strings.CURRENCY;

const dateLabel = (key: string) => {
  const monthly = key.length === 7;
  const date = new Date(monthly ? key + '-01' : key);
  return (monthly ? monthFormat : dateFormat).format(date);
};

type PaletteProp = { palette: ThemeColors };

export function RentalVolumeChart({ points, palette }: PaletteProp & { points: RentalVolumePoint[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const selectedIndex = points.findIndex(point => point.date === selectedDate);
  const index = selectedIndex < 0 ? points.length - 1 : selectedIndex;
  const active = points[index];
  const height = 118;
  const side = spacing.sm;
  const top = spacing.sm;
  const baseline = height - top;
  const min = Math.min(0, ...points.map(point => point.amount));
  const max = Math.max(0, ...points.map(point => point.amount));
  const x = (i: number) => points.length === 1 ? width / 2 : side + i * (width - 2 * side) / (points.length - 1);
  const y = (amount: number) => baseline - (amount - min) / (max - min || 1) * (baseline - top);
  const coordinates = points.map((point, i) => x(i) + ',' + y(point.amount)).join(' ');
  const ink = palette === colors.dark ? palette.primary : palette.primaryDark;
  const select = (position: number) => {
    const next = points[Math.max(0, Math.min(points.length - 1, position))];
    if (next) setSelectedDate(next.date);
  };

  if (!active) return <Text style={[styles.caption, { color: palette.textSecondary }]}>{strings.NO_VOLUME}</Text>;

  return (
    <View style={styles.chartContent}>
      <View style={[styles.tooltip, { backgroundColor: palette.primaryBg }]}>
        <View style={styles.tooltipCopy} accessibilityLiveRegion="polite">
          <Text style={[styles.caption, { color: palette.textSecondary }]}>{dateLabel(active.date)}</Text>
          <Text style={[styles.tooltipAmount, { color: palette.textPrimary }]}>{formatVnd(active.amount)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={strings.PREVIOUS_POINT} disabled={index === 0}
          accessibilityState={{ disabled: index === 0 }} onPress={() => select(index - 1)} style={styles.chartButton}>
          <Ionicons name="chevron-back" size={18} color={index === 0 ? palette.textMuted : ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={strings.NEXT_POINT} disabled={index === points.length - 1}
          accessibilityState={{ disabled: index === points.length - 1 }} onPress={() => select(index + 1)} style={styles.chartButton}>
          <Ionicons name="chevron-forward" size={18} color={index === points.length - 1 ? palette.textMuted : ink} />
        </Pressable>
      </View>
      <View style={styles.plotRow}>
        <View style={[styles.axis, { minWidth: 40 * fontScale }]}>
          <Text numberOfLines={1} style={[styles.axisLabel, { color: palette.textSecondary }]}>{formatCompact(max)}</Text>
          {min !== max && <Text numberOfLines={1} style={[styles.axisLabel, { color: palette.textSecondary }]}>{formatCompact(min)}</Text>}
        </View>
        <View style={styles.plot}>
          <Pressable
            accessible={false}
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            onPress={event => {
              const ratio = (event.nativeEvent.locationX - side) / Math.max(1, width - 2 * side);
              select(Math.round(ratio * (points.length - 1)));
            }}
            style={{ height }}
          >
            {width > 2 * side && (
              <Svg width={width} height={height} pointerEvents="none">
                {[top, height / 2, baseline].map(gridY => (
                  <Line key={gridY} x1={side} x2={width - side} y1={gridY} y2={gridY} stroke={palette.borderDefault} />
                ))}
                <Polygon points={x(0) + ',' + y(0) + ' ' + coordinates + ' ' + x(points.length - 1) + ',' + y(0)}
                  fill={palette.primary} opacity={0.15} />
                <Polyline points={coordinates} fill={theme.colors.transparent} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
                <Line x1={x(index)} x2={x(index)} y1={top} y2={baseline} stroke={ink} strokeOpacity={0.38} />
                <Circle cx={x(index)} cy={y(active.amount)} r={4.5} fill={ink} stroke={palette.surface} strokeWidth={2} />
              </Svg>
            )}
          </Pressable>
          <View style={styles.dates}>
            <Text numberOfLines={1} style={[styles.axisLabel, { color: palette.textSecondary }]}>{dateLabel(points[0].date)}</Text>
            {points.length > 1 && (
              <Text numberOfLines={1} style={[styles.axisLabel, { color: palette.textSecondary }]}>{dateLabel(points[points.length - 1].date)}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export function BookingStatusChart({ statuses, palette }: PaletteProp & { statuses: DashboardBookingStatus[] }) {
  const { width, fontScale } = useWindowDimensions();
  const total = statuses.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <Text style={[styles.caption, { color: palette.textSecondary }]}>{strings.NO_ORDERS}</Text>;
  const seriesColors: Record<string, string> = {
    active: palette.primary,
    approved: palette.primaryDark,
    completed: palette.success,
    pending: palette.warning,
    cancelled: palette.textMuted,
    rejected: palette.textSecondary,
    disputed: palette.error,
  };
  const size = 112;
  const radius = 45;
  const length = 2 * Math.PI * radius;
  const series = [...statuses].sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  let offset = 0;

  return (
    <View style={[styles.distribution, width / fontScale < 360 && styles.stacked]}>
      <View style={styles.ring} accessible accessibilityLabel={strings.ORDER_TOTAL + ', ' + formatCount(total)}>
        <Svg width={size} height={size} accessible={false}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={palette.borderDefault} strokeWidth={12} fill={theme.colors.transparent} />
          {series.map(row => {
            const segment = length * row.count / total;
            const start = offset;
            offset += segment;
            return <Circle key={row.status} cx={size / 2} cy={size / 2} r={radius}
              stroke={seriesColors[row.status] ?? palette.borderDefault} strokeWidth={12}
              strokeDasharray={[segment, length]} strokeDashoffset={-start}
              rotation={-90} originX={size / 2} originY={size / 2} fill={theme.colors.transparent} />;
          })}
        </Svg>
        <View style={styles.ringLabel} importantForAccessibility="no-hide-descendants">
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.ringTotal, { color: palette.textPrimary }]}>{formatCompact(total)}</Text>
        </View>
      </View>
      <View style={[styles.legend, width / fontScale < 360 && styles.fullLegend]}>
        {series.map(row => {
          const label = strings.STATUSES[row.status as keyof typeof strings.STATUSES] ?? row.status;
          return (
            <View key={row.status} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: seriesColors[row.status] ?? palette.borderDefault }]} />
              <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>{label}</Text>
              <Text style={[styles.legendNumber, { color: palette.textSecondary }]}>{formatCount(row.count)} · {percentFormat.format(row.count / total)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DeviceCategoryChart({ categories, palette }: PaletteProp & { categories: DashboardCategory[] }) {
  const top = [...categories].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
  const total = categories.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <Text style={[styles.caption, { color: palette.textSecondary }]}>{strings.NO_CATEGORIES}</Text>;
  return (
    <View style={styles.chartContent}>
      {top.map(row => (
        <View key={row.id} style={styles.category}>
          <View style={styles.categoryLabel}>
            <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>{row.name}</Text>
            <Text style={[styles.legendNumber, { color: palette.textSecondary }]}>{formatCount(row.count)} · {percentFormat.format(row.count / total)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: palette.borderSubtle }]}>
            <View style={[styles.track, { width: (row.count / total * 100) + '%' as `${number}%`, backgroundColor: palette.primary }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chartContent: { gap: spacing.sm },
  tooltip: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.sm, paddingLeft: spacing.sm, gap: spacing.xs, minHeight: 48 },
  tooltipCopy: { flex: 1, paddingVertical: spacing.xs },
  caption: { fontSize: typography.fontSize.sm },
  tooltipAmount: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, fontVariant: ['tabular-nums'] },
  chartButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plotRow: { flexDirection: 'row', gap: spacing.xs },
  axis: { alignItems: 'flex-end', justifyContent: 'space-between', height: 118, paddingBottom: spacing.xs },
  axisLabel: { fontSize: typography.fontSize.xs, fontVariant: ['tabular-nums'] },
  plot: { flex: 1, minWidth: 0 },
  dates: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  distribution: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stacked: { flexDirection: 'column' },
  ring: { width: 112, height: 112 },
  ringLabel: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  ringTotal: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, fontVariant: ['tabular-nums'] },
  legend: { flex: 1, minWidth: 0, gap: spacing.xs },
  fullLegend: { alignSelf: 'stretch', flex: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 23 },
  swatch: { width: 8, height: 8, borderRadius: radii.full },
  legendLabel: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  legendNumber: { fontSize: typography.fontSize.xs, fontVariant: ['tabular-nums'], textAlign: 'right' },
  category: { gap: spacing.xs },
  categoryLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 6, borderRadius: radii.full },
});
