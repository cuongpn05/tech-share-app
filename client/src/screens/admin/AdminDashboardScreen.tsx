import React, { ReactNode, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StatusBar,
  StyleSheet, Text, useColorScheme, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_STRINGS } from '../../constants/adminStrings';
import {
  BookingStatusChart, DeviceCategoryChart, formatCompact, formatCount, formatVnd, RentalVolumeChart,
} from '../../components/admin/AdminDashboardCharts';
import { AdminDashboardData, adminService, DashboardPeriod } from '../../services/adminService';
import { colors, ThemeColors } from '../../theme/colors';
import { theme } from '../../theme/tokens';

type DashboardRoutes = {
  AdminDashboard: undefined;
  DeviceModeration: undefined;
  EkycReviews: undefined;
  OwnerEkycReviews: undefined;
};

export interface AdminDashboardScreenProps {
  navigation?: DrawerNavigationProp<DashboardRoutes, 'AdminDashboard'>;
}

type IconName = keyof typeof Ionicons.glyphMap;
type DashboardAction = {
  label: string;
  count: number;
  icon: IconName;
  route?: 'EkycReviews' | 'OwnerEkycReviews' | 'DeviceModeration';
};
const strings = ADMIN_STRINGS.DASHBOARD;
const { spacing, radii, typography } = theme;
const periods: DashboardPeriod[] = ['7d', '30d', '90d', 'year'];

type DashboardStyles = ReturnType<typeof createStyles>;

function Panel({ title, caption, children, styles }: {
  title: string; caption?: string; children: ReactNode; styles: DashboardStyles;
}) {
  return (
    <View style={[styles.surface, styles.panel]}>
      <View style={styles.panelHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {!!caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
      {children}
    </View>
  );
}

function KpiCard({ label, icon, value, unit, accessibleValue, caption, onPress, wide, palette, styles }: {
  label: string; icon: IconName; value: string; accessibleValue?: string; caption: string; onPress?: () => void;
  unit?: string;
  wide: boolean; palette: ThemeColors; styles: DashboardStyles;
}) {
  const content = (
    <>
      <Ionicons name={icon} color={palette.textSecondary} size={18} />
      <Text numberOfLines={wide ? undefined : 1} style={styles.kpiLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.kpiValue}>
        {value}{unit && <Text style={styles.kpiUnit}>{' ' + unit}</Text>}
      </Text>
      <Text numberOfLines={wide ? undefined : 1} style={styles.caption}>{caption}</Text>
    </>
  );
  const cardStyle = [styles.surface, styles.kpiCard];
  const accessibilityLabel = [label, accessibleValue ?? value, caption].join(', ');
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : <View accessible accessibilityLabel={accessibilityLabel} style={cardStyle}>{content}</View>;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigation }) => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? colors.dark : colors.light;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const singleColumn = (width - insets.left - insets.right) / fontScale < 310;
  const periodColumns = (width - insets.left - insets.right) / fontScale < 305 ? 2 : 4;
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    adminService.getDashboard(period, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => controller.abort();
  }, [period, revision]);

  const refresh = () => {
    if (loading) return;
    setRefreshing(true);
    setRevision(value => value + 1);
  };

  const analytics = data?.analytics;
  const reportingPeriod = strings.PERIODS[analytics?.period ?? period];
  const orderCount = analytics?.bookingStatuses.reduce((total, row) => total + row.count, 0);
  const completedOrders = analytics?.bookingStatuses.find(row => row.status === 'completed')?.count ?? 0;
  const actionItems = data?.actionItems;
  const actionRows: DashboardAction[] = [
    { label: strings.RENTER_EKYC, count: actionItems?.pendingEkyc ?? 0, icon: 'id-card-outline', route: 'EkycReviews' },
    { label: strings.OWNER_EKYC, count: actionItems?.pendingOwnerEkyc ?? 0, icon: 'person-add-outline', route: 'OwnerEkycReviews' },
    { label: strings.DEVICE_APPROVALS, count: actionItems?.pendingDeviceApprovals ?? 0, icon: 'hardware-chip-outline', route: 'DeviceModeration' },
  ];
  const actions = actionRows.filter(item => item.count > 0);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <View style={[styles.headerContent, styles.contentWidth]}>
          <Pressable accessibilityRole="button" accessibilityLabel={strings.MENU}
            style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
            onPress={() => navigation?.openDrawer()}>
            <Ionicons name="menu-outline" size={22} color={palette.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>{strings.TITLE}</Text>
            <Text style={styles.caption}>{strings.SUBTITLE}</Text>
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}
          colors={[palette.primary]} tintColor={palette.primary} />}
      >
        <View style={[styles.contentWidth, styles.sections]}>
          {error && (
            <View accessibilityLiveRegion="polite" style={[styles.surface, styles.errorRow]}>
              <Ionicons name="alert-circle-outline" size={18} color={palette.error} />
              <Text style={[styles.caption, styles.fill]}>{data ? strings.STALE : strings.ERROR}</Text>
              <Pressable onPress={refresh} accessibilityRole="button" style={styles.retry}>
                <Text style={styles.selectedPeriodLabel}>{strings.RETRY}</Text>
              </Pressable>
            </View>
          )}

          {(data || loading) && (
            <View style={styles.panelHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{strings.OVERVIEW}</Text>
              <Text style={styles.caption}>{strings.LIFETIME}</Text>
            </View>
          )}

          {data ? (
            <View style={styles.kpiGrid}>
              <View style={singleColumn ? styles.kpiGrid : styles.row}>
                <KpiCard label={strings.KPI.VOLUME} icon="cash-outline" wide={singleColumn} palette={palette} styles={styles}
                  value={analytics ? formatCompact(analytics.grossRentalVolume) : strings.UNAVAILABLE}
                  unit={analytics ? strings.CURRENCY : undefined}
                  accessibleValue={analytics ? formatVnd(analytics.grossRentalVolume) : undefined} caption={reportingPeriod} />
                <KpiCard label={strings.KPI.USERS} icon="people-outline" wide={singleColumn} palette={palette} styles={styles}
                  value={formatCompact(data.kpis.totalUsers)} accessibleValue={formatCount(data.kpis.totalUsers)}
                  caption={strings.KPI.VERIFIED(formatCount(data.kpis.verifiedUsers))} />
              </View>
              <View style={singleColumn ? styles.kpiGrid : styles.row}>
                <KpiCard label={strings.KPI.DEVICES} icon="hardware-chip-outline" wide={singleColumn} palette={palette} styles={styles}
                  value={formatCompact(data.kpis.totalDevices)} accessibleValue={formatCount(data.kpis.totalDevices)}
                  caption={strings.KPI.AVAILABLE(formatCount(data.kpis.availableDevices))}
                  onPress={navigation ? () => navigation.navigate('DeviceModeration') : undefined} />
                <KpiCard label={strings.KPI.ORDERS} icon="receipt-outline" wide={singleColumn} palette={palette} styles={styles}
                  value={orderCount === undefined ? strings.UNAVAILABLE : formatCompact(orderCount)}
                  accessibleValue={orderCount === undefined ? undefined : formatCount(orderCount)}
                  caption={analytics ? strings.KPI.COMPLETED(formatCount(completedOrders)) : reportingPeriod} />
              </View>
            </View>
          ) : loading && (
            <View accessible accessibilityLabel={strings.LOADING} accessibilityState={{ busy: true }}>
              <View style={styles.kpiGrid}>
                {[0, 1].map(row => (
                  <View key={row} style={singleColumn ? styles.kpiGrid : styles.row}>
                    {[0, 1].map(column => (
                      <View key={column} style={[styles.surface, styles.kpiCard]}>
                        <View style={[styles.skeleton, styles.skeletonIcon]} />
                        <View style={[styles.skeleton, styles.skeletonLabel]} />
                        <View style={[styles.skeleton, styles.skeletonValue]} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.periodSection}>
            <View style={styles.periodHeading}>
              <Text style={styles.sectionTitle}>{strings.PERIOD}</Text>
              <View style={styles.periodIndicator}>
                {loading && <ActivityIndicator color={palette.primary} accessibilityLabel={strings.LOADING} />}
              </View>
            </View>
            {Array.from({ length: periods.length / periodColumns }, (_, index) => (
              <View key={index} style={styles.row}>
                {periods.slice(index * periodColumns, (index + 1) * periodColumns).map(option => (
                  <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: period === option }}
                    onPress={() => setPeriod(option)}
                    style={({ pressed }) => [styles.period, option === period && styles.selectedPeriod, pressed && styles.pressed]}>
                    <Text numberOfLines={1} style={[styles.periodLabel, option === period && styles.selectedPeriodLabel]}>
                      {strings.PERIODS[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {data ? (
            <>
              <Panel title={strings.TRENDS} caption={reportingPeriod + ' · ' + strings.VOLUME_SCOPE} styles={styles}>
                {analytics ? (
                  <>
                    {analytics.volumeBookingCount === 0 && <Text style={styles.caption}>{strings.NO_VOLUME}</Text>}
                    <RentalVolumeChart points={analytics.rentalVolumeTrend} palette={palette} />
                  </>
                ) : <Text style={styles.caption}>{strings.UNAVAILABLE}</Text>}
              </Panel>

              <Panel title={strings.BOOKINGS} caption={reportingPeriod + ' · ' + strings.BOOKING_SCOPE} styles={styles}>
                {analytics ? <BookingStatusChart statuses={analytics.bookingStatuses} palette={palette} />
                  : <Text style={styles.caption}>{strings.UNAVAILABLE}</Text>}
              </Panel>

              <Panel title={strings.CATEGORIES} caption={strings.CATEGORY_SCOPE} styles={styles}>
                <DeviceCategoryChart categories={data.categoryBreakdown} palette={palette} />
              </Panel>

              <Panel title={strings.ACTIONS} styles={styles}>
                {actions.length ? actions.map((item, index) => {
                  const route = item.route;
                  const content = (
                    <>
                      <Ionicons name={item.icon} size={17} color={palette.textSecondary} />
                      <Text style={[styles.actionLabel, styles.fill]}>{item.label}</Text>
                      <Text style={styles.actionCount}>{formatCount(item.count)}</Text>
                      {route && navigation && <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />}
                    </>
                  );
                  const row = [styles.actionRow, index > 0 && styles.actionDivider];
                  return route && navigation ? (
                    <Pressable key={item.label} accessibilityRole="button"
                      accessibilityLabel={item.label + ', ' + formatCount(item.count)}
                      onPress={() => navigation.navigate(route)}
                      style={({ pressed }) => [row, pressed && styles.pressed]}>
                      {content}
                    </Pressable>
                  ) : <View key={item.label} style={row}>{content}</View>;
                }) : (
                  <View style={styles.noActions}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={palette.success} />
                    <Text style={[styles.caption, styles.fill]}>{strings.NO_ACTIONS}</Text>
                  </View>
                )}
              </Panel>
            </>
          ) : loading && (
            <View accessible accessibilityLabel={strings.LOADING} accessibilityState={{ busy: true }} style={styles.sections}>
              <Panel title={strings.TRENDS} caption={reportingPeriod + ' · ' + strings.VOLUME_SCOPE} styles={styles}>
                <View style={[styles.skeleton, styles.skeletonChart]} />
              </Panel>
              <Panel title={strings.BOOKINGS} styles={styles}>
                <View style={[styles.skeleton, styles.skeletonRing]} />
              </Panel>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(palette: ThemeColors) {
  const accent = palette === colors.dark ? palette.primary : palette.primaryDark;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    contentWidth: { width: '100%', maxWidth: 600, alignSelf: 'center' },
    header: { backgroundColor: palette.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderDefault },
    headerContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
    menu: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    title: { color: palette.textPrimary, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold },
    caption: { color: palette.textSecondary, fontSize: typography.fontSize.sm },
    scroll: { padding: spacing.md },
    sections: { gap: spacing.lg },
    periodSection: { gap: spacing.sm },
    periodHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
    periodIndicator: { width: 24, alignItems: 'center' },
    period: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: spacing.xs, justifyContent: 'center', alignItems: 'center', borderWidth: 1,
      borderColor: palette.borderDefault, borderRadius: radii.sm, backgroundColor: palette.surface },
    selectedPeriod: { backgroundColor: palette.primaryLight, borderColor: palette.primary },
    periodLabel: { color: palette.textSecondary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
    selectedPeriodLabel: { color: accent, fontWeight: typography.fontWeight.bold },
    row: { flexDirection: 'row', gap: spacing.sm },
    kpiGrid: { gap: spacing.sm },
    surface: { borderWidth: 1, borderColor: palette.borderDefault, borderRadius: radii.md, backgroundColor: palette.card },
    kpiCard: { flex: 1, minWidth: 0, minHeight: 116, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm + spacing.xs, gap: spacing.xs },
    kpiLabel: { color: palette.textSecondary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
    kpiValue: { color: palette.textPrimary, fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, fontVariant: ['tabular-nums'] },
    kpiUnit: { color: palette.textSecondary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
    panel: { padding: spacing.md, gap: spacing.md },
    panelHeading: { gap: spacing.xs },
    sectionTitle: { color: palette.textPrimary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm + spacing.xs },
    retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
    fill: { flex: 1, minWidth: 0 },
    actionLabel: { color: palette.textPrimary, fontSize: typography.fontSize.base },
    actionCount: { color: palette.textPrimary, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, fontVariant: ['tabular-nums'] },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingVertical: spacing.xs },
    actionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.borderDefault },
    noActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pressed: { opacity: 0.68 },
    skeleton: { backgroundColor: palette.borderSubtle, borderRadius: radii.xs },
    skeletonIcon: { width: 18, height: 18 },
    skeletonLabel: { width: '75%', height: 14, marginTop: spacing.xs },
    skeletonValue: { width: '60%', height: 24 },
    skeletonChart: { height: 188 },
    skeletonRing: { width: 112, height: 112, borderRadius: radii.full, alignSelf: 'center' },
  });
}

export default AdminDashboardScreen;
