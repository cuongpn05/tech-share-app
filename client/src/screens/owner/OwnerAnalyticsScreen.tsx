import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RevenueChart, RevenuePeriod, RevenuePoint } from '../../components/analytics/RevenueChart';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { theme } from '../../theme/tokens';
import { OwnerAnalyticsBooking, OwnerAnalyticsData, ownerAnalyticsService } from '../../services/ownerAnalyticsService';
import { useAppSelector } from '../../store';

interface OwnerAnalyticsScreenProps {
  navigation?: {
    openDrawer?: () => void;
  };
}

const getBookingDate = (booking: OwnerAnalyticsBooking) =>
  new Date(booking.updatedAt || booking.endDate || booking.startDate);

const formatDate = (dateValue: string) => {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const formatCurrency = (amount: number) => `${amount.toLocaleString()} VND`;

const getMonthlyChartData = (bookings: OwnerAnalyticsBooking[]): RevenuePoint[] => {
  const today = new Date();
  return Array.from({ length: 5 }, (_, index) => ({
    label: `W${index + 1}`,
    revenue: bookings.reduce((sum, booking) => {
      const date = getBookingDate(booking);
      const sameMonth = date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth();
      return sameMonth && Math.floor((date.getDate() - 1) / 7) === index
        ? sum + Number(booking.rentalFee || 0)
        : sum;
    }, 0),
  }));
};

export const OwnerAnalyticsScreen: React.FC<OwnerAnalyticsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const token = useAppSelector(state => state.auth.token);
  const [period, setPeriod] = useState<RevenuePeriod>('week');
  const [analytics, setAnalytics] = useState<OwnerAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAnalytics = useCallback(async () => {
    if (!token) {
      setAnalytics(null);
      setErrorMessage(OWNER_STRINGS.ANALYTICS.LOAD_ERROR);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await ownerAnalyticsService.getOwnerAnalytics(token);
      setAnalytics(data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : OWNER_STRINGS.ANALYTICS.LOAD_ERROR,
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const chartData = useMemo(() => {
    if (!analytics) return [];
    if (period === 'month') return getMonthlyChartData(analytics.bookings);
    return analytics.revenueByDay.map(point => ({ label: point.day, revenue: point.revenue }));
  }, [analytics, period]);

  const availableDevices = analytics?.devices.filter(device => device.status === 'available').length || 0;
  const utilization = Math.min(Math.max(analytics?.utilizationRate || 0, 0), 100);
  const bookings = analytics?.bookings || [];

  const renderSectionHeading = (icon: keyof typeof Ionicons.glyphMap, title: string) => (
    <View style={styles.sectionHeading}>
      <Ionicons name={icon} size={18} color={theme.colors.brand[600]} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={OWNER_STRINGS.ANALYTICS.MENU_ACCESSIBILITY_LABEL}
          onPress={() => navigation?.openDrawer?.()}
          style={styles.menuButton}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{OWNER_STRINGS.ANALYTICS.TITLE}</Text>
          <Text style={styles.headerSubtitle}>{OWNER_STRINGS.ANALYTICS.SUBTITLE}</Text>
        </View>
      </View>

      {!token ? (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.colors.red} />
          <Text style={styles.stateText}>{OWNER_STRINGS.ANALYTICS.LOAD_ERROR}</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.stateText}>{OWNER_STRINGS.ANALYTICS.LOADING}</Text>
        </View>
      ) : errorMessage && !analytics ? (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.colors.red} />
          <Text style={styles.stateText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            setIsLoading(true);
            void fetchAnalytics();
          }}>
            <Text style={styles.retryText}>{OWNER_STRINGS.ANALYTICS.RETRY}</Text>
          </TouchableOpacity>
        </View>
      ) : analytics ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void fetchAnalytics();
              }}
              tintColor={theme.colors.brand[600]}
              colors={[theme.colors.brand[600]]}
            />
          }
        >
          <View style={styles.revenueCard}>
            <View style={styles.revenueHeading}>
              <View style={styles.revenueIcon}>
                <Ionicons name="wallet-outline" size={20} color={theme.colors.brand[600]} />
              </View>
              <Text style={styles.metricLabel}>{OWNER_STRINGS.ANALYTICS.TOTAL_REVENUE}</Text>
            </View>
            <Text style={styles.revenueAmount}>{formatCurrency(analytics.totalRevenue)}</Text>
            <Text style={styles.growthText}>
              {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth}% this month
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.trendHeader}>
              {renderSectionHeading('trending-up-outline', OWNER_STRINGS.ANALYTICS.REVENUE_TREND)}
              <View style={styles.periodSelector}>
                {(['week', 'month'] as const).map(item => (
                  <TouchableOpacity
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: period === item }}
                    onPress={() => setPeriod(item)}
                    style={[styles.periodButton, period === item && styles.periodButtonSelected]}
                  >
                    <Text style={[styles.periodText, period === item && styles.periodTextSelected]}>
                      {item === 'week' ? OWNER_STRINGS.TIMEFRAME.WEEK : OWNER_STRINGS.TIMEFRAME.MONTH}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <RevenueChart data={chartData} period={period} />
          </View>

          <View style={styles.section}>
            {renderSectionHeading('pie-chart-outline', OWNER_STRINGS.ANALYTICS.UTILIZATION)}
            <View style={styles.card}>
              <View style={styles.utilizationInfo}>
                <Text style={styles.utilizationValue}>{Math.round(utilization)}%</Text>
                <Text style={styles.utilizationDescription}>
                  {OWNER_STRINGS.ANALYTICS.RENTED_RATIO(analytics.rentedDevices, analytics.totalDevices)}
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: utilization }}
                style={styles.progressTrack}
              >
                <View style={[styles.progressBar, { width: `${utilization}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            {renderSectionHeading('cube-outline', OWNER_STRINGS.ANALYTICS.DEVICE_STATS)}
            <View style={styles.statsRow}>
              {[
                { label: OWNER_STRINGS.ANALYTICS.TOTAL_DEVICES, value: analytics.totalDevices, color: theme.colors.brand[600] },
                { label: OWNER_STRINGS.ANALYTICS.RENTED_DEVICES, value: analytics.rentedDevices, color: theme.colors.amber },
                { label: OWNER_STRINGS.ANALYTICS.AVAILABLE_DEVICES, value: availableDevices, color: theme.colors.green },
              ].map(item => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            {renderSectionHeading('receipt-outline', OWNER_STRINGS.ANALYTICS.PAYMENT_HISTORY)}
            {bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={theme.colors.text.muted} />
                <Text style={styles.emptyTitle}>{OWNER_STRINGS.ANALYTICS.EMPTY_PAYMENTS_TITLE}</Text>
                <Text style={styles.emptyDescription}>{OWNER_STRINGS.ANALYTICS.EMPTY_PAYMENTS_DESCRIPTION}</Text>
              </View>
            ) : bookings.map(booking => {
              const device = typeof booking.deviceId === 'string' ? null : booking.deviceId;
              const renter = typeof booking.renterId === 'string' ? null : booking.renterId;
              return (
                <View key={booking._id} style={styles.paymentCard}>
                  <View style={styles.paymentIcon}>
                    <Ionicons name="receipt-outline" size={18} color={theme.colors.brand[600]} />
                  </View>
                  <View style={styles.paymentDetails}>
                    <Text style={styles.paymentDevice} numberOfLines={1}>
                      {device?.name || OWNER_STRINGS.ANALYTICS.UNKNOWN_DEVICE}
                    </Text>
                    <Text style={styles.paymentRenter} numberOfLines={1}>
                      {OWNER_STRINGS.ANALYTICS.RENTER_PREFIX}{renter?.name || OWNER_STRINGS.ANALYTICS.UNKNOWN_RENTER}
                    </Text>
                    <Text style={styles.paymentDate}>{formatDate(booking.updatedAt || booking.endDate)}</Text>
                  </View>
                  <View style={styles.paymentAmountColumn}>
                    <Text style={styles.paymentAmount}>{formatCurrency(booking.rentalFee)}</Text>
                    <Text style={styles.completedStatus}>{OWNER_STRINGS.ANALYTICS.COMPLETED}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.fontSize.sm,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  stateText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[500],
  },
  retryText: {
    color: theme.colors.white,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  revenueCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  revenueHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  revenueIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[100],
  },
  metricLabel: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  revenueAmount: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    marginTop: theme.spacing.md,
  },
  growthText: {
    color: theme.colors.green,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceMuted,
  },
  periodButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
  periodButtonSelected: {
    backgroundColor: theme.colors.brand[500],
  },
  periodText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  periodTextSelected: {
    color: theme.colors.white,
  },
  card: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  utilizationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  utilizationValue: {
    color: theme.colors.brand[600],
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
  },
  utilizationDescription: {
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'right',
  },
  progressTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border.light,
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[500],
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statLabel: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  emptyTitle: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    marginTop: theme.spacing.sm,
  },
  emptyDescription: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  paymentIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.brand[100],
  },
  paymentDetails: {
    flex: 1,
    minWidth: 0,
  },
  paymentDevice: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  paymentRenter: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  paymentDate: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  paymentAmountColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  paymentAmount: {
    color: theme.colors.green,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  completedStatus: {
    color: theme.colors.green,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
});
