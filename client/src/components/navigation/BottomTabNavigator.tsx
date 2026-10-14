/**
 * BottomTabNavigator.tsx
 * Thanh điều hướng 4 Tab với Pill Indicator bo tròn mượt mà riêng cho Icon.
 *
 * Thiết kế:
 * - Active: icon đặc + nền oval `primaryLight` (chỉ bọc icon, KHÔNG bọc chữ).
 * - Inactive: icon outline + text màu muted.
 * - Badge đếm đơn thuê chờ xử lý trên Tab 2 (Đơn thuê).
 *
 * Tuân thủ 100% Design Tokens từ src/constants/theme.ts (theme-skill.md).
 * Không hardcode bất kỳ mã màu hex nào trong component này.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { ScreenType } from '../../types';
import { STRINGS } from '../../constants/strings';

// ─── Types ───────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  key: ScreenType;
  label: string;
  iconActive: IoniconsName;
  iconInactive: IoniconsName;
  badgeCount?: number;
}

interface BottomTabNavigatorProps {
  enabledTabs?: ScreenType[];
  activeTab: ScreenType;
  onTabPress: (tab: ScreenType) => void;
  /** Padding bottom an toàn cho iOS Home Indicator và Android Nav Bar */
  safeAreaBottom?: number;
  /** Số đơn thuê đang chờ xử lý — hiển thị badge trên Tab "Đơn thuê" */
  pendingBookingsCount?: number;
}

// ─── Tab Configuration ────────────────────────────────────────────────────────

const TAB_CONFIGS: TabConfig[] = [
  {
    key: 'home',
    label: STRINGS.BOTTOM_NAV.HOME,
    iconActive: 'home',
    iconInactive: 'home-outline',
  },
  {
    key: 'bookings',
    label: STRINGS.BOTTOM_NAV.BOOKINGS,
    iconActive: 'receipt',
    iconInactive: 'receipt-outline',
  },
  {
    key: 'map',
    label: STRINGS.BOTTOM_NAV.NEARBY,
    iconActive: 'map',
    iconInactive: 'map-outline',
  },
  {
    key: 'compare',
    label: STRINGS.BOTTOM_NAV.COMPARE,
    iconActive: 'git-compare',
    iconInactive: 'git-compare-outline',
  },
  {
    key: 'profile',
    label: STRINGS.BOTTOM_NAV.PROFILE,
    iconActive: 'person',
    iconInactive: 'person-outline',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function BottomTabNavigator({
  activeTab,
  enabledTabs = ['home'],
  onTabPress,
  safeAreaBottom = 0,
  pendingBookingsCount = 0,
}: BottomTabNavigatorProps) {
  const tabs = TAB_CONFIGS.map((tab) => ({
    ...tab,
    badgeCount: tab.key === 'bookings' ? pendingBookingsCount : 0,
  }));

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(safeAreaBottom, theme.spacing.sm) },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TabItem
            key={tab.key}
            tab={tab}
            isActive={isActive}
            disabled={!enabledTabs.includes(tab.key)}
            onPress={() => onTabPress(tab.key)}
          />
        );
      })}
    </View>
  );
}

// ─── TabItem Sub-component ────────────────────────────────────────────────────

interface TabItemProps {
  tab: TabConfig & { badgeCount: number };
  isActive: boolean;
  disabled: boolean;
  onPress: () => void;
}

function TabItem({ tab, isActive, onPress, disabled }: TabItemProps) {
  const iconName = isActive ? tab.iconActive : tab.iconInactive;
  const iconColor = isActive
    ? theme.primary
    : theme.textMuted;

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive, disabled }}
      accessibilityLabel={tab.label}
    >
      {/* ── Pill Icon Wrapper (chỉ bọc icon, KHÔNG bao gồm label) ── */}
      <View style={styles.iconWrapperOuter}>
        <View
          style={[
            styles.iconPill,
            isActive && styles.iconPillActive,
          ]}
        >
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>

        {/* Badge đếm — chỉ hiển thị khi badgeCount > 0 */}
        {tab.badgeCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              {tab.badgeCount > 99 ? '99+' : String(tab.badgeCount)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Tab Label ── */}
      <Text
        style={[
          styles.tabLabel,
          isActive ? styles.tabLabelActive : styles.tabLabelInactive,
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /**
   * Thanh tab bar — nền trắng phẳng, viền trên mảnh, bóng nhẹ hướng lên.
   * Chiều cao thoáng: paddingTop + paddingBottom + content ≈ 62-66px.
   */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,          // #FFFFFF
    borderTopWidth: 1,
    borderTopColor: theme.border,         // #E2E8F0
    paddingTop: 8,

    // Cross-platform shadow hướng lên trên
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.slate[900],
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: theme.shadows.subtle.shadowOpacity,  // 0.04
        shadowRadius: theme.shadows.subtle.shadowRadius,    // 4
      },
      android: {
        elevation: theme.shadows.card.elevation,            // 3
      },
    }),
  },

  /**
   * Mỗi tab item — KHÔNG có backgroundColor.
   * Chỉ căn giữa theo chiều dọc, flex đều nhau.
   */
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',   // giữ icon + label sát nhau từ trên xuống
    paddingBottom: 6,
  },

  /** Wrapper tương đối chứa pill icon + badge số */
  iconWrapperOuter: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /**
   * Pill bọc RIÊNG icon — dạng viên thuốc ngang (landscape oval).
   * Inactive: nền hoàn toàn trong suốt, chỉ icon hiển thị.
   *
   * Kích thước cố định:  width 52 × height 28.
   * borderRadius: 9999   → hai đầu ngang vát tròn mềm mại.
   */
  iconPill: {
    width: 52,
    height: 28,
    borderRadius: 9999,               // theme.radii.full = 9999
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',   // inactive: KHÔNG nền
  },

  /**
   * Active pill — nền nhạt primaryLight (brand-100: #E8F6F7).
   * Tuân thủ theme-skill.md Nguyên tắc 2: Nền nhạt brand-100, icon đậm brand-500.
   */
  iconPillActive: {
    backgroundColor: theme.primaryLight,
  },

  /** Badge số đơn chờ xử lý — góc trên phải pill */
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: theme.radii.full,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: theme.card,                   // viền trắng tách badge
  },
  badgeText: {
    ...theme.typography.badge,
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '700',
  },

  /** Label dưới icon */
  tabLabel: {
    width: '100%',
    paddingHorizontal: 2,
    fontSize: 11,
    letterSpacing: 0.1,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabLabelActive: {
    color: theme.primaryDark,
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: theme.textMuted,
    fontWeight: '500',
  },
});
