import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
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
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';

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
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month'>('week');
  const [refreshing, setRefreshing] = useState(false);

  // Dữ liệu mặc định khởi tạo chuẩn theo thiết kế (Ảnh 1 & 2)
  const [profile, setProfile] = useState<OwnerProfileData>({
    id: '6ab13ee23bb7f33ae04d2c88',
    username: OWNER_STRINGS.PROFILE.DEFAULT_USERNAME,
    email: OWNER_STRINGS.PROFILE.DEFAULT_EMAIL,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    rating: '4.9',
    reviewsCount: 28,
    trustScore: 100,
    badge: OWNER_STRINGS.PROFILE.TOP_OWNER_BADGE,
  });

  const [kpis, setKpis] = useState<OwnerKpisData>({
    netRevenue: 35110000,
    netRevenueFormatted: OWNER_STRINGS.METRICS.DEFAULT_NET_REVENUE,
    totalRentals: 94,
    totalRentalsFormatted: OWNER_STRINGS.METRICS.DEFAULT_TOTAL_RENTALS,
    activeRentals: 0,
    activeRentalsFormatted: OWNER_STRINGS.METRICS.DEFAULT_ACTIVE_RENTALS,
    occupancyRate: 0,
    occupancyRateFormatted: OWNER_STRINGS.METRICS.DEFAULT_OCCUPANCY_RATE,
  });

  const [wallet, setWallet] = useState<OwnerWalletData>({
    availableBalance: 28088000,
    availableBalanceFormatted: OWNER_STRINGS.WALLET.DEFAULT_AVAILABLE,
    escrowHolding: 15000000,
    escrowHoldingFormatted: OWNER_STRINGS.WALLET.DEFAULT_ESCROW,
    monthlyRevenue: 35110000,
    monthlyRevenueFormatted: OWNER_STRINGS.WALLET.DEFAULT_MONTHLY,
    monthlyTrend: OWNER_STRINGS.WALLET.DEFAULT_TREND,
  });

  const [chart, setChart] = useState<OwnerChartData>({
    title: OWNER_STRINGS.CHART.TITLE,
    peakFormatted: OWNER_STRINGS.CHART.PEAK_PREFIX,
    peakValue: 18700000,
    yMax: 22100000,
    yLabels: ['22.1M', '16.5M', '11.0M', '5.5M', '0'],
    dataPoints: [
      { day: 'Mon', revenue: 3200000, label: '3.2M' },
      { day: 'Tue', revenue: 18700000, label: '18.7M' },
      { day: 'Wed', revenue: 5100000, label: '5.1M' },
      { day: 'Thu', revenue: 12400000, label: '12.4M' },
      { day: 'Fri', revenue: 8200000, label: '8.2M' },
      { day: 'Sat', revenue: 15300000, label: '15.3M' },
      { day: 'Sun', revenue: 10500000, label: '10.5M' },
    ],
  });

  // Tải dữ liệu từ Backend API MongoDB Atlas
  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoints = [
        'http://192.168.1.36:5000/api/owner/dashboard',
        'http://10.0.2.2:5000/api/owner/dashboard',
        'http://localhost:5000/api/owner/dashboard',
      ];

      let jsonResult: any = null;
      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            jsonResult = await response.json();
            break;
          }
        } catch {
          // Thử tiếp endpoint dự phòng
        }
      }

      if (jsonResult && jsonResult.success && jsonResult.data) {
        const d = jsonResult.data;
        if (d.profile) setProfile(d.profile);
        if (d.kpis) setKpis(d.kpis);
        if (d.wallet) setWallet(d.wallet);
        if (d.chart) setChart(d.chart);
      }
    } catch (err) {
      console.log('[OwnerDashboard] Dùng dữ liệu bộ nhớ dự phòng:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  // Tính toán kích thước SVG Chart
  const chartCardWidth = SCREEN_WIDTH - theme.spacing.lg * 2;
  const svgWidth = chartCardWidth - 24;
  const svgHeight = 175;
  const leftAxisWidth = 46;
  const rightPadding = 12;
  const plotWidth = svgWidth - leftAxisWidth - rightPadding;
  const topPadding = 16;
  const bottomPadding = 30;
  const plotHeight = svgHeight - topPadding - bottomPadding;

  const yMax = chart.yMax || 22100000;
  const points = chart.dataPoints;

  // Tọa độ các điểm vẽ biểu đồ
  const coords = points.map((p, index) => {
    const x = leftAxisWidth + (index / (points.length - 1)) * plotWidth;
    const ratio = Math.min(1, Math.max(0, p.revenue / yMax));
    const y = topPadding + (1 - ratio) * plotHeight;
    return { x, y, ...p };
  });

  // Tạo đường cong Cubic Bezier mượt mà (Smooth Area Curve)
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
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${topPadding + plotHeight} L ${coords[0].x} ${topPadding + plotHeight} Z`;

  return (
    <View style={[styles.screenContainer, { paddingTop: statusBarOffset }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
        translucent={true}
      />
      {/* 1. Header Navigation Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.openDrawer?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{OWNER_STRINGS.HEADER.TITLE}</Text>
          <Text style={styles.headerSubtitle}>{OWNER_STRINGS.HEADER.SUBTITLE}</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation?.navigate?.('OwnerNotifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.brand[500]]}
          />
        }
      >
        {/* 2. Thẻ Profile người dùng (owner1) */}
        <View style={styles.profileCard}>
          <Image source={{ uri: profile.avatar }} style={styles.profileAvatar} />

          <View style={styles.profileInfo}>
            <Text style={styles.profileUsername}>{profile.username}</Text>

            <View style={styles.badgesRow}>
              {/* Rating badge */}
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  ★ {profile.rating} ({profile.reviewsCount})
                </Text>
              </View>

              {/* Trust score badge */}
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <Text style={styles.trustText}>Trust: {profile.trustScore}</Text>
              </View>
            </View>

            {/* Top Owner Pill */}
            <View style={styles.topOwnerPill}>
              <Text style={styles.topOwnerText}>{profile.badge}</Text>
            </View>
          </View>
        </View>

        {/* 3. Section Header: Performance & Revenue + Segmented Toggle */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="stats-chart-outline" size={17} color={theme.colors.brand[500]} />
            </View>
            <Text style={styles.sectionTitle}>{OWNER_STRINGS.TIMEFRAME.SECTION_TITLE}</Text>
          </View>

          {/* Timeframe Toggle: Week / Month */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                selectedTimeframe === 'week' && styles.segmentTabActive,
              ]}
              onPress={() => setSelectedTimeframe('week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedTimeframe === 'week'
                    ? styles.segmentTextActive
                    : styles.segmentTextInactive,
                ]}
              >
                {OWNER_STRINGS.TIMEFRAME.WEEK}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentTab,
                selectedTimeframe === 'month' && styles.segmentTabActive,
              ]}
              onPress={() => setSelectedTimeframe('month')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedTimeframe === 'month'
                    ? styles.segmentTextActive
                    : styles.segmentTextInactive,
                ]}
              >
                {OWNER_STRINGS.TIMEFRAME.MONTH}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. 4 Metric Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Net Revenue */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#E6F7F7' }]}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.brand[500]} />
            </View>
            <Text style={styles.kpiLabel}>{OWNER_STRINGS.METRICS.NET_REVENUE}</Text>
            <Text style={styles.kpiValueLarge}>{kpis.netRevenueFormatted}</Text>
          </View>

          {/* Card 2: Total Rentals */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-sharp" size={20} color="#16A34A" />
            </View>
            <Text style={styles.kpiLabel}>{OWNER_STRINGS.METRICS.TOTAL_RENTALS}</Text>
            <Text style={styles.kpiValueLarge}>{kpis.totalRentalsFormatted}</Text>
          </View>

          {/* Card 3: Active Rentals */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="flash-outline" size={20} color="#D97706" />
            </View>
            <Text style={styles.kpiLabel}>{OWNER_STRINGS.METRICS.ACTIVE_RENTALS}</Text>
            <Text style={styles.kpiValueLarge}>{kpis.activeRentalsFormatted}</Text>
          </View>

          {/* Card 4: Occupancy Rate */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="pie-chart-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.kpiLabel}>{OWNER_STRINGS.METRICS.OCCUPANCY_RATE}</Text>
            <Text style={styles.kpiValueLarge}>{kpis.occupancyRateFormatted}</Text>
          </View>
        </View>

        {/* 5. Revenue last 7 days (VND) Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <View style={styles.chartDot} />
              <Text style={styles.chartTitleText}>{chart.title}</Text>
            </View>
            <View style={styles.peakPill}>
              <Text style={styles.peakText}>{chart.peakFormatted}</Text>
            </View>
          </View>

          {/* Biểu đồ SVG Area Chart */}
          <View style={styles.svgContainer}>
            <Svg width={svgWidth} height={svgHeight}>
              <Defs>
                <SvgGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#2DD4BF" stopOpacity="0.4" />
                  <Stop offset="0.7" stopColor="#99F6E4" stopOpacity="0.15" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.0" />
                </SvgGradient>
              </Defs>

              {/* Các đường grid ngang và nhãn trục Y */}
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

              {/* Vùng bóng màu Gradient (Area Fill) */}
              <Path d={areaPath} fill="url(#chartGradient)" />

              {/* Đường line biểu đồ màu xanh Teal */}
              <Path
                d={linePath}
                fill="none"
                stroke="#2DD4BF"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Điểm nút (Data point circular dots) */}
              {coords.map((pt, idx) => (
                <React.Fragment key={`dot-${idx}`}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={5.5}
                    fill="#FFFFFF"
                    stroke="#2DD4BF"
                    strokeWidth={2.5}
                  />
                  {/* Nhãn trục X: Mon, Tue,... */}
                  <SvgText
                    x={pt.x}
                    y={svgHeight - 8}
                    fill="#64748B"
                    fontSize={12}
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {pt.day}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
          </View>
        </View>

        {/* 6. Thẻ Available Balance & Wallet Details */}
        <View style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>{OWNER_STRINGS.WALLET.AVAILABLE_BALANCE}</Text>
              <Text style={styles.balanceAmount}>{wallet.availableBalanceFormatted}</Text>
            </View>

            <TouchableOpacity style={styles.withdrawButton} activeOpacity={0.85}>
              <Ionicons name="wallet-outline" size={17} color="#FFFFFF" />
              <Text style={styles.withdrawText}>{OWNER_STRINGS.WALLET.WITHDRAW}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.walletDivider} />

          <View style={styles.walletBottomStats}>
            {/* Cột trái: Escrow Holding */}
            <View style={styles.walletStatColumn}>
              <View style={styles.statLabelRow}>
                <Ionicons name="time-outline" size={15} color="#F59E0B" />
                <Text style={styles.statLabelText}>{OWNER_STRINGS.WALLET.ESCROW_HOLDING}</Text>
              </View>
              <Text style={styles.escrowAmountText}>{wallet.escrowHoldingFormatted}</Text>
            </View>

            <View style={styles.walletVerticalDivider} />

            {/* Cột phải: Monthly Revenue */}
            <View style={styles.walletStatColumn}>
              <View style={styles.statLabelRow}>
                <Ionicons name="trending-up-outline" size={15} color={theme.colors.brand[500]} />
                <Text style={styles.statLabelText}>{OWNER_STRINGS.WALLET.MONTHLY_REVENUE}</Text>
              </View>
              <View style={styles.monthlyValueRow}>
                <Text style={styles.monthlyAmountText}>{wallet.monthlyRevenueFormatted}</Text>
                <Text style={styles.monthlyTrendText}>{wallet.monthlyTrend}</Text>
              </View>
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
    backgroundColor: theme.colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 36,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.surfaceMuted,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileUsername: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trustText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
    marginLeft: 4,
  },
  topOwnerPill: {
    backgroundColor: '#E6F7F7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  topOwnerText: {
    color: theme.colors.brand[500],
    fontSize: 11.5,
    fontWeight: theme.typography.fontWeight.bold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E6F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 3,
  },
  segmentTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 13,
  },
  segmentTabActive: {
    backgroundColor: '#E6F7F7',
  },
  segmentText: {
    fontSize: 12.5,
  },
  segmentTextActive: {
    color: theme.colors.brand[500],
    fontWeight: theme.typography.fontWeight.bold,
  },
  segmentTextInactive: {
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.medium,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - theme.spacing.lg * 2 - 12) / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  kpiIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 13,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: 12,
  },
  kpiValueLarge: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.brand[400],
    marginRight: 8,
  },
  chartTitleText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#475569',
  },
  peakPill: {
    backgroundColor: '#E6F7F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  peakText: {
    color: theme.colors.brand[500],
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  walletCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
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
    fontSize: 13,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.medium,
  },
  balanceAmount: {
    fontSize: 23,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginTop: 6,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    ...theme.shadows.card,
  },
  withdrawText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
    marginLeft: 6,
  },
  walletDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
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
    height: 38,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 10,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabelText: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    marginLeft: 5,
  },
  escrowAmountText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#D97706',
    marginTop: 6,
  },
  monthlyValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  monthlyAmountText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  monthlyTrendText: {
    fontSize: 12.5,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.brand[500],
    marginLeft: 4,
  },
});

export default OwnerDashboardScreen;
