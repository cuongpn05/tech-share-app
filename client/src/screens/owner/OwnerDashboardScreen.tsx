import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Line,
  Text as SvgText,
  Circle,
} from 'react-native-svg';
import { API_BASE_URL, apiClient } from '../../config/api';
import { colors } from '../../theme/colors';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
import { bookingService } from '../../services/bookingService';
import { notificationService } from '../../services/notificationService';
import { socketService } from '../../services/socketService';
import { useAppSelector } from '../../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface OwnerDashboardScreenProps {
  navigation?: any;
}

interface OwnerProfileData {
  id: string;
  username: string;
  email: string;
  avatar: string;
  rating: string;
  reviewsCount: number;
  trustScore: number;
  badge: string;
}

interface OwnerKpisData {
  netRevenue: number;
  netRevenueFormatted: string;
  totalRentals: number;
  totalRentalsFormatted: string;
  activeRentals: number;
  activeRentalsFormatted: string;
  occupancyRate: number;
  occupancyRateFormatted: string;
}

interface OwnerWalletData {
  availableBalance: number;
  availableBalanceFormatted: string;
  escrowHolding: number;
  escrowHoldingFormatted: string;
  monthlyRevenue: number;
  monthlyRevenueFormatted: string;
  monthlyTrend: string;
}

interface ChartPoint {
  day: string;
  revenue: number;
  label: string;
}

interface OwnerChartData {
  title: string;
  peakFormatted: string;
  peakValue: number;
  yMax: number;
  yLabels: string[];
  dataPoints: ChartPoint[];
}

export const OwnerDashboardScreen: React.FC<OwnerDashboardScreenProps> = ({ navigation }) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id;

  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(
    notificationService.getUnreadCountCached()
  );

  const [profile, setProfile] = useState<OwnerProfileData>({
    id: '',
    username: '',
    email: '',
    avatar: '',
    rating: '0.0',
    reviewsCount: 0,
    trustScore: 0,
    badge: 'Equipment Owner',
  });

  const [kpis, setKpis] = useState<OwnerKpisData>({
    netRevenue: 0,
    netRevenueFormatted: '0 VND',
    totalRentals: 0,
    totalRentalsFormatted: '0 orders',
    activeRentals: 0,
    activeRentalsFormatted: '0 devices',
    occupancyRate: 0,
    occupancyRateFormatted: '0%',
  });

  const [wallet, setWallet] = useState<OwnerWalletData>({
    availableBalance: 0,
    availableBalanceFormatted: '0 VND',
    escrowHolding: 0,
    escrowHoldingFormatted: '0 VND',
    monthlyRevenue: 0,
    monthlyRevenueFormatted: '0 VND',
    monthlyTrend: '',
  });

  const [chart, setChart] = useState<OwnerChartData>({
    title: 'Revenue last 7 days (VND)',
    peakFormatted: 'Peak: 0 VND',
    peakValue: 0,
    yMax: 0,
    yLabels: ['0', '0', '0', '0', '0'],
    dataPoints: [],
  });

  // Rental Activity Summary Counts
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [awaitingHandoverCount, setAwaitingHandoverCount] = useState<number>(0);
  const [activeRentalsCount, setActiveRentalsCount] = useState<number>(0);

  // Fetch Dashboard Data from API
  const fetchDashboardData = useCallback(
    async (timeframe = selectedTimeframe) => {
      try {
        const userId = currentUserId;
        const res = await apiClient.get('/owner/dashboard', {
          params: {
            ...(userId ? { userId } : {}),
            timeframe,
          },
        });

        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          if (d.profile) setProfile(d.profile);
          if (d.kpis) setKpis(d.kpis);
          if (d.wallet) setWallet(d.wallet);
          if (d.chart) setChart(d.chart);
          if (d.pendingBookingsCount !== undefined) setPendingCount(d.pendingBookingsCount);
          if (d.awaitingHandoverCount !== undefined) {
            setAwaitingHandoverCount(d.awaitingHandoverCount);
          }
          if (d.activeRentalsCount !== undefined) {
            setActiveRentalsCount(d.activeRentalsCount);
          }
          return;
        }
      } catch {
        try {
          const userId = currentUserId;
          const query = `?timeframe=${timeframe}${userId ? `&userId=${userId}` : ''}`;
          const response = await fetch(`${API_BASE_URL}/owner/dashboard${query}`);
          if (response.ok) {
            const jsonResult = await response.json();
            if (jsonResult?.success && jsonResult?.data) {
              const d = jsonResult.data;
              if (d.profile) setProfile(d.profile);
              if (d.kpis) setKpis(d.kpis);
              if (d.wallet) setWallet(d.wallet);
              if (d.chart) setChart(d.chart);
              if (d.pendingBookingsCount !== undefined) setPendingCount(d.pendingBookingsCount);
              if (d.awaitingHandoverCount !== undefined) {
                setAwaitingHandoverCount(d.awaitingHandoverCount);
              }
              if (d.activeRentalsCount !== undefined) {
                setActiveRentalsCount(d.activeRentalsCount);
              }
            }
          }
        } catch (err) {
          console.warn('[OwnerDashboard] Error loading dashboard data:', err);
        }
      }

      // Synchronize booking activity counts via bookingService
      try {
        if (currentUserId) {
          const allOwnerBookings = await bookingService.getOwnerBookings('all', currentUserId);
          if (Array.isArray(allOwnerBookings)) {
            setPendingCount(allOwnerBookings.filter((b) => b.status === 'pending').length);
            setAwaitingHandoverCount(
              allOwnerBookings.filter((b) => b.status === 'approved').length
            );
            setActiveRentalsCount(
              allOwnerBookings.filter((b) => b.status === 'active').length
            );
          }
        }
      } catch {
        // Soft fail
      }
    },
    [currentUserId, selectedTimeframe]
  );

  useEffect(() => {
    fetchDashboardData(selectedTimeframe);
  }, [fetchDashboardData, selectedTimeframe]);

  useEffect(() => {
    const userId = currentUserId;
    if (userId) {
      notificationService.fetchUnreadCount(userId);
    }
    const unsubNotifCount = notificationService.onUnreadCountChange((count) => {
      setUnreadNotifications(count);
    });
    const unsubNotif = socketService.onNotification(() => {
      if (userId) {
        notificationService.fetchUnreadCount(userId);
      } else {
        notificationService.incrementUnreadCount();
      }
    });

    const unsubBookings = bookingService.onBookingsUpdated(() => {
      fetchDashboardData(selectedTimeframe);
    });

    return () => {
      unsubNotifCount();
      unsubNotif();
      unsubBookings();
    };
  }, [currentUserId, fetchDashboardData, selectedTimeframe]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(selectedTimeframe);
      if (currentUserId) {
        notificationService.fetchUnreadCount(currentUserId);
      }
    }, [fetchDashboardData, currentUserId, selectedTimeframe])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData(selectedTimeframe);
    setRefreshing(false);
  };

  const handleTimeframeChange = (tf: 'week' | 'month') => {
    setSelectedTimeframe(tf);
    fetchDashboardData(tf);
  };

  const handleWithdrawPress = () => {
    if (wallet.availableBalance <= 0) {
      Alert.alert(
        'Withdrawal Unavailable',
        'Your available balance is currently 0 VND. Complete rentals to earn balance for withdrawal.'
      );
    } else {
      Alert.alert(
        'Withdrawal Request',
        `Available balance: ${wallet.availableBalanceFormatted}\n\nWithdrawals are processed securely via our payments team to your registered bank account within 24 hours.`,
        [{ text: 'OK' }]
      );
    }
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 16
  );
  const bottomInset = Math.max(insets.bottom + 20, 32);

  // SVG Chart Layout & Dimensions
  const chartCardWidth = SCREEN_WIDTH - 40;
  const svgWidth = chartCardWidth - 28;
  const svgHeight = 160;
  const leftAxisWidth = 44;
  const rightPadding = 12;
  const plotWidth = svgWidth - leftAxisWidth - rightPadding;
  const topPadding = 14;
  const bottomPadding = 26;
  const plotHeight = svgHeight - topPadding - bottomPadding;

  const points =
    chart.dataPoints && chart.dataPoints.length > 0
      ? chart.dataPoints
      : [
          { day: 'Mon', revenue: 0, label: '0' },
          { day: 'Tue', revenue: 0, label: '0' },
          { day: 'Wed', revenue: 0, label: '0' },
          { day: 'Thu', revenue: 0, label: '0' },
          { day: 'Fri', revenue: 0, label: '0' },
          { day: 'Sat', revenue: 0, label: '0' },
          { day: 'Sun', revenue: 0, label: '0' },
        ];

  const hasRevenue = chart.peakValue > 0 && points.some((p) => p.revenue > 0);

  const coords = points.map((p, index) => {
    const x = leftAxisWidth + (index / Math.max(1, points.length - 1)) * plotWidth;
    const ratio = chart.yMax > 0 ? Math.min(1, Math.max(0, p.revenue / chart.yMax)) : 0;
    const y = topPadding + (1 - ratio) * plotHeight;
    return { x, y, ...p };
  });

  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = createSmoothPath(coords);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${topPadding + plotHeight} L ${coords[0].x} ${topPadding + plotHeight} Z`
      : '';

  return (
    <View style={[styles.screenContainer, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.background} />

      {/* 1. Compact Dashboard Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open Navigation Menu"
          style={styles.headerIconButton}
          onPress={() => navigation?.openDrawer?.()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu-outline" size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Owner Dashboard</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Performance overview
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.navigate?.('OwnerNotifications')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="View Notifications"
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.light.textPrimary} />
          {unreadNotifications > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.light.primary]}
            tintColor={colors.light.primary}
          />
        }
      >
        {/* 2. Simplified Owner Profile Card */}
        <View style={styles.profileCard}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.profileAvatar} />
          ) : (
            <View style={styles.profileAvatarPlaceholder}>
              <Ionicons name="person" size={24} color={colors.light.textSecondary} />
            </View>
          )}

          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileUsername} numberOfLines={1}>
                {profile.username || 'Device Owner'}
              </Text>
              <View style={styles.ownerRoleTag}>
                <Text style={styles.ownerRoleTagText}>
                  {profile.badge || 'Equipment Owner'}
                </Text>
              </View>
            </View>

            {/* Inlined Rating & Trust without heavy colored badge backgrounds */}
            <View style={styles.profileMetaRow}>
              <View style={styles.profileMetaItem}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.profileMetaText}>
                  {profile.rating} ({profile.reviewsCount})
                </Text>
              </View>

              <Text style={styles.profileMetaDot}>•</Text>

              <View style={styles.profileMetaItem}>
                <Ionicons name="shield-checkmark" size={13} color={colors.light.primaryDark} />
                <Text style={styles.profileMetaText}>
                  Trust: {profile.trustScore}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Rental Activity Summary (Operational Overview) */}
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Rental Activity</Text>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('OwnerPendingBookings')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.activityViewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityStatsRow}>
            <TouchableOpacity
              style={styles.activityStatCol}
              onPress={() => navigation?.navigate?.('OwnerPendingBookings')}
              activeOpacity={0.75}
            >
              <Text style={[styles.activityCount, pendingCount > 0 && styles.activityCountActive]}>
                {pendingCount}
              </Text>
              <Text style={styles.activityLabel}>Pending</Text>
            </TouchableOpacity>

            <View style={styles.activityDivider} />

            <TouchableOpacity
              style={styles.activityStatCol}
              onPress={() => navigation?.navigate?.('OwnerPendingBookings')}
              activeOpacity={0.75}
            >
              <Text style={[styles.activityCount, awaitingHandoverCount > 0 && styles.activityCountActive]}>
                {awaitingHandoverCount}
              </Text>
              <Text style={styles.activityLabel}>Handover</Text>
            </TouchableOpacity>

            <View style={styles.activityDivider} />

            <TouchableOpacity
              style={styles.activityStatCol}
              onPress={() => navigation?.navigate?.('OwnerPendingBookings')}
              activeOpacity={0.75}
            >
              <Text style={[styles.activityCount, activeRentalsCount > 0 && styles.activityCountActive]}>
                {activeRentalsCount}
              </Text>
              <Text style={styles.activityLabel}>Active</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Section Header: Performance & Revenue + Segmented Toggle */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Performance & Revenue</Text>

          {/* Segmented Timeframe Toggle */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                selectedTimeframe === 'week' && styles.segmentTabActive,
              ]}
              onPress={() => handleTimeframeChange('week')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedTimeframe === 'week' && styles.segmentTextActive,
                ]}
              >
                Week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentTab,
                selectedTimeframe === 'month' && styles.segmentTabActive,
              ]}
              onPress={() => handleTimeframeChange('month')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedTimeframe === 'month' && styles.segmentTextActive,
                ]}
              >
                Month
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. 4 Unified KPI Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Net Revenue */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconCircle}>
              <Ionicons name="cash-outline" size={19} color={colors.light.primaryDark} />
            </View>
            <Text style={styles.kpiLabel}>Net Revenue</Text>
            <Text style={styles.kpiValueLarge} numberOfLines={1}>
              {kpis.netRevenueFormatted}
            </Text>
          </View>

          {/* Card 2: Total Rentals */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconCircle}>
              <Ionicons name="receipt-outline" size={19} color={colors.light.primaryDark} />
            </View>
            <Text style={styles.kpiLabel}>Total Rentals</Text>
            <Text style={styles.kpiValueLarge} numberOfLines={1}>
              {kpis.totalRentalsFormatted}
            </Text>
          </View>

          {/* Card 3: Active Rentals */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconCircle}>
              <Ionicons name="repeat-outline" size={19} color={colors.light.primaryDark} />
            </View>
            <Text style={styles.kpiLabel}>Active Rentals</Text>
            <Text style={styles.kpiValueLarge} numberOfLines={1}>
              {kpis.activeRentalsFormatted}
            </Text>
          </View>

          {/* Card 4: Occupancy Rate */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconCircle}>
              <Ionicons name="pie-chart-outline" size={19} color={colors.light.primaryDark} />
            </View>
            <Text style={styles.kpiLabel}>Occupancy Rate</Text>
            <Text style={styles.kpiValueLarge} numberOfLines={1}>
              {kpis.occupancyRateFormatted}
            </Text>
          </View>
        </View>

        {/* 6. Revenue Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitleText}>{chart.title}</Text>
            {hasRevenue && (
              <View style={styles.peakPill}>
                <Text style={styles.peakText}>{chart.peakFormatted}</Text>
              </View>
            )}
          </View>

          {/* Zero revenue compact empty state vs active SVG chart */}
          {!hasRevenue ? (
            <View style={styles.chartEmptyWrap}>
              <View style={styles.chartEmptyIconCircle}>
                <Ionicons name="bar-chart-outline" size={26} color={colors.light.textMuted} />
              </View>
              <Text style={styles.chartEmptyTitle}>No revenue yet</Text>
              <Text style={styles.chartEmptySubtitle}>
                Your revenue statistics will appear here once rentals are completed.
              </Text>
            </View>
          ) : (
            <View style={styles.svgContainer}>
              <Svg width={svgWidth} height={svgHeight}>
                <Defs>
                  <SvgGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.light.primary} stopOpacity="0.3" />
                    <Stop offset="0.8" stopColor={colors.light.primaryLight} stopOpacity="0.08" />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </SvgGradient>
                </Defs>

                {/* Horizontal Grid lines & Y axis labels */}
                {chart.yLabels.map((lbl, idx) => {
                  const ratio = idx / (chart.yLabels.length - 1);
                  const yPos = topPadding + ratio * plotHeight;
                  return (
                    <React.Fragment key={`grid-${idx}`}>
                      <SvgText
                        x={leftAxisWidth - 8}
                        y={yPos + 4}
                        fill="#94A3B8"
                        fontSize={11}
                        fontWeight="500"
                        textAnchor="end"
                      >
                        {lbl}
                      </SvgText>
                      <Line
                        x1={leftAxisWidth}
                        y1={yPos}
                        x2={svgWidth - rightPadding}
                        y2={yPos}
                        stroke="#F1F5F9"
                        strokeWidth={1}
                        strokeDasharray="4, 4"
                      />
                    </React.Fragment>
                  );
                })}

                {/* Area Gradient Fill */}
                <Path d={areaPath} fill="url(#chartGradient)" />

                {/* Primary Teal Line Stroke */}
                <Path
                  d={linePath}
                  fill="none"
                  stroke={colors.light.primary}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data point circular dots */}
                {coords.map((pt, idx) => (
                  <React.Fragment key={`dot-${idx}`}>
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={4.5}
                      fill="#FFFFFF"
                      stroke={colors.light.primary}
                      strokeWidth={2}
                    />
                    <SvgText
                      x={pt.x}
                      y={svgHeight - 6}
                      fill="#64748B"
                      fontSize={11.5}
                      fontWeight="500"
                      textAnchor="middle"
                    >
                      {pt.day}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            </View>
          )}
        </View>

        {/* 7. Available Balance & Wallet Section */}
        <View style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>{wallet.availableBalanceFormatted}</Text>
            </View>

            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={handleWithdrawPress}
              activeOpacity={0.85}
              accessibilityLabel="Withdraw available balance"
              accessibilityRole="button"
            >
              <Ionicons name="wallet-outline" size={16} color={colors.light.white} />
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.walletDivider} />

          <View style={styles.walletBottomStats}>
            {/* Left: Escrow Holding */}
            <View style={styles.walletStatColumn}>
              <View style={styles.statLabelRow}>
                <Ionicons name="time-outline" size={14} color={colors.light.textSecondary} />
                <Text style={styles.statLabelText}>Escrow Holding</Text>
              </View>
              <Text style={styles.statAmountText}>{wallet.escrowHoldingFormatted}</Text>
            </View>

            <View style={styles.walletVerticalDivider} />

            {/* Right: Monthly Revenue */}
            <View style={styles.walletStatColumn}>
              <View style={styles.statLabelRow}>
                <Ionicons name="trending-up-outline" size={14} color={colors.light.primaryDark} />
                <Text style={styles.statLabelText}>Monthly Revenue</Text>
              </View>
              <Text style={styles.statAmountText}>{wallet.monthlyRevenueFormatted}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.light.background,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.light.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.light.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.light.white,
  },
  notifBadgeText: {
    color: colors.light.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    marginBottom: 12,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.light.background,
  },
  profileAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileUsername: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.light.textPrimary,
    flex: 1,
  },
  ownerRoleTag: {
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  ownerRoleTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  profileMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileMetaText: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  profileMetaDot: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  activityCard: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    marginBottom: 14,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  activityViewAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.light.primaryDark,
  },
  activityStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityStatCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  activityCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  activityCountActive: {
    color: colors.light.primaryDark,
  },
  activityLabel: {
    fontSize: 11.5,
    color: colors.light.textSecondary,
    marginTop: 3,
  },
  activityDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.light.borderSubtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  segmentTab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 7,
  },
  segmentTabActive: {
    backgroundColor: colors.light.primary,
  },
  segmentText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: colors.light.white,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 40 - 10) / 2,
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    fontWeight: '500',
    marginTop: 10,
  },
  kpiValueLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  chartCard: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartTitleText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  peakPill: {
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  peakText: {
    color: colors.light.primaryDark,
    fontSize: 11.5,
    fontWeight: '700',
  },
  chartEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  chartEmptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  chartEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  chartEmptySubtitle: {
    fontSize: 12,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 240,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  walletTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12.5,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 10,
    gap: 6,
  },
  withdrawText: {
    color: colors.light.white,
    fontSize: 13,
    fontWeight: '700',
  },
  walletDivider: {
    height: 1,
    backgroundColor: colors.light.borderSubtle,
    marginVertical: 14,
  },
  walletBottomStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletStatColumn: {
    flex: 1,
  },
  walletVerticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.light.borderSubtle,
    marginHorizontal: 12,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabelText: {
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  statAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginTop: 4,
  },
});

export default OwnerDashboardScreen;
