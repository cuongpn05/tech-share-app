import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/tokens';
import { ADMIN_STRINGS } from '../constants/adminStrings';

export interface AdminSidebarContentProps {
  navigation?: any;
  activeRoute?: string;
}

interface MenuItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  routeName: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    title: ADMIN_STRINGS.SIDEBAR.MENU.DASHBOARD,
    icon: 'stats-chart',
    routeName: 'AdminDashboard',
  },
  {
    id: 'users',
    title: ADMIN_STRINGS.SIDEBAR.MENU.USERS,
    icon: 'people-outline',
    routeName: 'UserManagement',
  },
  {
    id: 'devices',
    title: ADMIN_STRINGS.SIDEBAR.MENU.DEVICES,
    icon: 'hardware-chip-outline',
    routeName: 'DeviceModeration',
  },
  {
    id: 'disputes',
    title: ADMIN_STRINGS.SIDEBAR.MENU.DISPUTES,
    icon: 'chatbox-ellipses-outline',
    routeName: 'DepositDisputes',
  },
  {
    id: 'ekyc',
    title: ADMIN_STRINGS.SIDEBAR.MENU.EKYC,
    icon: 'finger-print-outline',
    routeName: 'EkycReviews',
  },
  {
    id: 'vouchers',
    title: ADMIN_STRINGS.SIDEBAR.MENU.VOUCHERS,
    icon: 'pricetag-outline',
    routeName: 'VouchersPromotions',
  },
];

export const AdminSidebarContent: React.FC<AdminSidebarContentProps> = ({
  navigation,
  activeRoute = 'AdminDashboard',
}) => {
  const handleNavigate = (routeName: string) => {
    if (navigation?.navigate) {
      navigation.navigate(routeName);
    }
  };

  const handleSignOut = () => {
    if (navigation?.closeDrawer) {
      navigation.closeDrawer();
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. PROFILE HEADER */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          {/* Avatar phụ nữ xanh tím như trong ảnh thiết kế */}
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
              }}
              style={styles.avatarImage}
            />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {ADMIN_STRINGS.SIDEBAR.PROFILE.NAME}
            </Text>
            <Text style={styles.profileEmail}>
              {ADMIN_STRINGS.SIDEBAR.PROFILE.EMAIL}
            </Text>
          </View>
        </View>
      </View>

      {/* Đường kẻ phân cách */}
      <View style={styles.divider} />

      {/* 2. SECTION HEADER & MENU LIST */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {ADMIN_STRINGS.SIDEBAR.SECTION_HEADER}
        </Text>
      </View>

      <ScrollView
        style={styles.menuList}
        contentContainerStyle={styles.menuListContent}
        showsVerticalScrollIndicator={false}
      >
        {MENU_ITEMS.map((item) => {
          const isActive = activeRoute === item.routeName;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                isActive && styles.menuItemActive,
              ]}
              onPress={() => handleNavigate(item.routeName)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={isActive ? theme.colors.brand[500] : theme.colors.text.secondary}
                style={styles.menuIcon}
              />
              <Text
                style={[
                  styles.menuText,
                  isActive && styles.menuTextActive,
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. FOOTER SIGN OUT BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={theme.colors.red}
            style={styles.signOutIcon}
          />
          <Text style={styles.signOutText}>
            {ADMIN_STRINGS.SIDEBAR.SIGN_OUT}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 48,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: theme.colors.purpleLight,
    borderWidth: 2,
    borderColor: theme.colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.divider,
    marginVertical: theme.spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.muted,
    letterSpacing: 0.8,
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingVertical: theme.spacing.xs,
    gap: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.xl,
  },
  menuItemActive: {
    backgroundColor: theme.colors.brand[100],
  },
  menuIcon: {
    marginRight: theme.spacing.md,
    width: 24,
  },
  menuText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  menuTextActive: {
    color: theme.colors.brand[500],
    fontWeight: theme.typography.fontWeight.bold,
  },
  footer: {
    paddingVertical: theme.spacing.md,
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.redLight,
    borderWidth: 1.5,
    borderColor: theme.colors.redBorder,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
  },
  signOutIcon: {
    marginRight: theme.spacing.sm,
  },
  signOutText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.red,
  },
});

export default AdminSidebarContent;
