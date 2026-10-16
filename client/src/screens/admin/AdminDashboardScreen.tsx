import { API_BASE_URL, apiClient } from '../../config/api';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { ADMIN_STRINGS } from '../../constants/adminStrings';

export interface AdminDashboardScreenProps {
  navigation?: any;
}

interface DashboardKpis {
  rentalVolume: number;
  rentalVolumeFormatted: string;
  rentalVolumeTrend: string;
  totalUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  totalDevices: number;
  rentedDevices: number;
  availableDevices: number;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
}

interface ActionItemsData {
  pendingDisputes: number;
  pendingEkyc: number;
  isSmooth: boolean;
  message: string;
}

interface CategoryBreakdownItem {
  id: string;
  name: string;
  percentage: number;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface DashboardData {
  kpis: DashboardKpis;
  actionItems: ActionItemsData;
  categoryBreakdown: CategoryBreakdownItem[];
}

const DEFAULT_DASHBOARD_DATA: DashboardData = {
  kpis: {
    rentalVolume: 0,
    rentalVolumeFormatted: '0 VND',
    rentalVolumeTrend: '',
    totalUsers: 0,
    verifiedUsers: 0,
    activeUsers: 0,
    totalDevices: 0,
    rentedDevices: 0,
    availableDevices: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
  },
  actionItems: {
    pendingDisputes: 0,
    pendingEkyc: 0,
    isSmooth: true,
    message: ADMIN_STRINGS.ACTION_ITEMS.STATUS_OK,
  },
  categoryBreakdown: [],
};

const CATEGORY_STYLES: Record<
  string,
  { color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  cameras: {
    color: theme.colors.categories.cameras,
    icon: 'camera-outline',
  },
  laptops: {
    color: theme.colors.categories.laptops,
    icon: 'laptop-outline',
  },
  smartphones: {
    color: theme.colors.categories.smartphones,
    icon: 'phone-portrait-outline',
  },
  gaming: {
    color: theme.colors.categories.gaming,
    icon: 'game-controller-outline',
  },
};

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigation }) => {
  const [data, setData] = useState<DashboardData>(DEFAULT_DASHBOARD_DATA);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Gọi API lấy dữ liệu trực tiếp từ MongoDB Atlas
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/dashboard');
      if (response.data?.success && response.data?.data) {
        setData(response.data.data);
        return;
      }
    } catch {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/dashboard`);
        if (res.ok) {
          const result = await res.json();
          if (result && result.success && result.data) {
            setData(result.data);
          }
        }
      } catch (err) {
        console.warn('Error fetching admin dashboard:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Thao tác kéo xuống để làm mới (Pull-to-refresh)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setIsRefreshing(false);
  };

  const handleOpenDrawer = () => {
    if (navigation?.openDrawer) {
      navigation.openDrawer();
    }
  };

  const { kpis, actionItems, categoryBreakdown } = data;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* 1. TOP HEADER BAR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleOpenDrawer}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{ADMIN_STRINGS.HEADER.TITLE}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.brand[500]]}
            tintColor={theme.colors.brand[500]}
          />
        }
      >
        {/* 2. SECTION: PLATFORM PERFORMANCE OVERVIEW */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="stats-chart"
            size={20}
            color={theme.colors.brand[500]}
            style={styles.sectionHeaderIcon}
          />
          <Text style={styles.sectionTitle}>
            {ADMIN_STRINGS.SECTIONS.PERFORMANCE}
          </Text>
        </View>

        {/* 2x2 Grid KPI Cards (Dữ liệu từ MongoDB) */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Gross Rental Volume */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: theme.colors.greenLight }]}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.green} />
            </View>
            <Text style={styles.kpiLabel}>{ADMIN_STRINGS.KPIS.RENTAL_VOLUME.LABEL}</Text>
            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
              {kpis.rentalVolumeFormatted}
            </Text>
            {kpis.rentalVolumeTrend ? (
              <View style={styles.trendRow}>
                <Ionicons name="trending-up" size={14} color={theme.colors.green} />
                <Text style={styles.trendText}>
                  {kpis.rentalVolumeTrend}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Card 2: Users */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: theme.colors.blueLight }]}>
              <Ionicons name="people-outline" size={20} color={theme.colors.blue} />
            </View>
            <Text style={styles.kpiLabel}>{ADMIN_STRINGS.KPIS.USERS.LABEL}</Text>
            <Text style={styles.kpiValue}>
              {`${kpis.totalUsers} Accounts`}
            </Text>
            <Text style={styles.kpiSubtitle}>
              {`${kpis.verifiedUsers} Verified • ${kpis.activeUsers} Active`}
            </Text>
          </View>

          {/* Card 3: Total Devices */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: theme.colors.amberLight }]}>
              <Ionicons name="hardware-chip-outline" size={20} color={theme.colors.amber} />
            </View>
            <Text style={styles.kpiLabel}>{ADMIN_STRINGS.KPIS.DEVICES.LABEL}</Text>
            <Text style={styles.kpiValue}>
              {`${kpis.totalDevices} Units`}
            </Text>
            <Text style={styles.kpiSubtitle}>
              {`${kpis.rentedDevices} Rented • ${kpis.availableDevices} Available`}
            </Text>
          </View>

          {/* Card 4: Rental Orders */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: theme.colors.purpleLight }]}>
              <Ionicons name="receipt-outline" size={20} color={theme.colors.purple} />
            </View>
            <Text style={styles.kpiLabel}>{ADMIN_STRINGS.KPIS.ORDERS.LABEL}</Text>
            <Text style={styles.kpiValue}>
              {`${kpis.totalOrders} Orders`}
            </Text>
            <Text style={styles.kpiSubtitle}>
              {`${kpis.activeOrders} Active • ${kpis.completedOrders} Completed`}
            </Text>
          </View>
        </View>

        {/* 3. SECTION: ACTION ITEMS */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={theme.colors.brand[500]}
            style={styles.sectionHeaderIcon}
          />
          <Text style={styles.sectionTitle}>
            {ADMIN_STRINGS.SECTIONS.ACTION_ITEMS}
          </Text>
        </View>

        <View style={styles.actionItemsCard}>
          <View style={styles.checkmarkCircle}>
            <Ionicons
              name={actionItems.isSmooth ? 'checkmark-circle' : 'alert-circle'}
              size={36}
              color={actionItems.isSmooth ? theme.colors.green : theme.colors.amber}
            />
          </View>
          <Text style={styles.actionItemsMessage}>
            {actionItems.message}
          </Text>
        </View>

        {/* 4. SECTION: RENTAL CATEGORY BREAKDOWN */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="trending-up"
            size={20}
            color={theme.colors.brand[500]}
            style={styles.sectionHeaderIcon}
          />
          <Text style={styles.sectionTitle}>
            {ADMIN_STRINGS.SECTIONS.CATEGORY_BREAKDOWN}
          </Text>
        </View>

        <View style={styles.categoriesCard}>
          {categoryBreakdown.length === 0 ? (
            <View style={styles.emptyCategoriesContainer}>
              <Ionicons name="pie-chart-outline" size={32} color={theme.colors.text.muted} />
              <Text style={styles.emptyCategoriesText}>Chưa có dữ liệu danh mục thiết bị</Text>
            </View>
          ) : (
            categoryBreakdown.map((cat, index) => {
              const styleConfig = CATEGORY_STYLES[cat.id] || {
                color: theme.colors.brand[500],
                icon: 'cube-outline',
              };

              return (
                <View
                  key={cat.id}
                  style={[
                    styles.categoryRow,
                    index === categoryBreakdown.length - 1 && styles.categoryRowLast,
                  ]}
                >
                  {/* Category Icon & Name */}
                  <View style={styles.categoryLeft}>
                    <Ionicons
                      name={styleConfig.icon}
                      size={18}
                      color={styleConfig.color}
                      style={styles.categoryIcon}
                    />
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </View>

                  {/* Progress Bar Track & Fill */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${cat.percentage}%`, backgroundColor: styleConfig.color },
                      ]}
                    />
                  </View>

                  {/* Percentage */}
                  <Text style={styles.percentageText}>{cat.percentage}%</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    ...theme.shadows.card,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderIcon: {
    marginRight: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  kpiCard: {
    width: '47.5%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  kpiIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  kpiLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.green,
    marginLeft: 3,
  },
  kpiSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.fontWeight.normal,
  },
  actionItemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  checkmarkCircle: {
    marginBottom: theme.spacing.xs,
  },
  actionItemsMessage: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  categoriesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
    ...theme.shadows.card,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  categoryRowLast: {
    paddingBottom: 0,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 140,
  },
  categoryIcon: {
    marginRight: theme.spacing.sm,
  },
  categoryName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.full,
    marginHorizontal: theme.spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radii.full,
  },
  percentageText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    width: 38,
    textAlign: 'right',
  },
  emptyCategoriesContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCategoriesText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
  },
});

export default AdminDashboardScreen;
