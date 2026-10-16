import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/tokens';
import { OWNER_STRINGS } from '../constants/ownerStrings';
import { chatService } from '../services/chatService';
import { socketService } from '../services/socketService';
import { apiClient } from '../config/api';
import { useAppSelector } from '../store';

export interface OwnerSidebarContentProps {
  navigation?: any;
  activeRoute?: string;
  pendingCount?: number;
}

interface MenuItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  routeName: string;
  badge?: number;
}

export const OwnerSidebarContent: React.FC<OwnerSidebarContentProps> = ({
  navigation,
  activeRoute = 'OwnerDashboard',
  pendingCount: propPendingCount,
}) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(propPendingCount ?? 0);

  const loadSidebarData = useCallback(async () => {
    try {
      const convs = await chatService.getConversations();
      if (Array.isArray(convs)) {
        const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setUnreadMessages(total);
      }
    } catch {}

    try {
      const userId = currentUser?._id || (currentUser as any)?.id;
      const res = await apiClient.get('/owner/dashboard', {
        params: userId ? { userId } : {},
      });
      if (res.data?.success && res.data?.data) {
        setPendingBookings(res.data.data.pendingBookingsCount || 0);
      }
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    loadSidebarData();
    const unsub = socketService.onNewMessage(() => {
      loadSidebarData();
    });
    const unsubRead = socketService.onMessagesRead(() => {
      loadSidebarData();
    });
    return () => {
      unsub();
      unsubRead();
    };
  }, [loadSidebarData]);

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      title: OWNER_STRINGS.SIDEBAR.DASHBOARD_KPIS,
      icon: 'stats-chart-outline',
      routeName: 'OwnerDashboard',
    },
    {
      id: 'analytics',
      title: OWNER_STRINGS.SIDEBAR.REVENUE_ANALYTICS,
      icon: 'trending-up-outline',
      routeName: 'OwnerRevenueAnalytics',
    },
    {
      id: 'bookings',
      title: OWNER_STRINGS.SIDEBAR.PENDING_BOOKINGS,
      icon: 'receipt-outline',
      routeName: 'OwnerPendingBookings',
      badge: pendingBookings > 0 ? pendingBookings : undefined,
    },
    {
      id: 'messages',
      title: OWNER_STRINGS.SIDEBAR.CUSTOMER_MESSAGES,
      icon: 'chatbubble-ellipses-outline',
      routeName: 'OwnerMessages',
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      id: 'inventory',
      title: OWNER_STRINGS.SIDEBAR.MY_DEVICE_INVENTORY,
      icon: 'cube-outline',
      routeName: 'OwnerDeviceInventory',
    },
    {
      id: 'list_device',
      title: OWNER_STRINGS.SIDEBAR.LIST_NEW_DEVICES,
      icon: 'add-circle-outline',
      routeName: 'OwnerListDevice',
    },
    {
      id: 'wallet',
      title: OWNER_STRINGS.SIDEBAR.REVENUE_DEPOSIT_WALLET,
      icon: 'wallet-outline',
      routeName: 'OwnerWallet',
    },
    {
      id: 'ai_assistant',
      title: OWNER_STRINGS.SIDEBAR.AI_ASSISTANT,
      icon: 'sparkles-outline',
      routeName: 'OwnerAiAssistant',
    },
    {
      id: 'renter_mode',
      title: OWNER_STRINGS.SIDEBAR.SWITCH_TO_RENTER_MODE,
      icon: 'swap-horizontal-outline',
      routeName: 'RenterMode',
    },
    {
      id: 'notifications',
      title: OWNER_STRINGS.SIDEBAR.SYSTEM_NOTIFICATIONS,
      icon: 'notifications-outline',
      routeName: 'OwnerNotifications',
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    if (navigation) {
      navigation.navigate(item.routeName);
      navigation.closeDrawer?.();
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      OWNER_STRINGS.SIDEBAR.SIGN_OUT,
      'Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc chủ thiết bị không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => console.log('Owner signed out') },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarOffset + theme.spacing.lg }]}>
      {/* 1. Header Profile */}
      <View style={styles.profileSection}>
        {currentUser?.avatar ? (
          <Image
            source={{ uri: currentUser.avatar }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.colors.brand[50],
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name="person" size={24} color={theme.colors.brand[500]} />
          </View>
        )}
        <View style={styles.profileDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.usernameText}>
              {currentUser?.name || currentUser?.username || 'Owner'}
            </Text>
            {currentUser?.isVerified ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.brand[500]}
                style={styles.verifiedIcon}
              />
            ) : null}
          </View>
          <Text style={styles.emailText} numberOfLines={1}>
            {currentUser?.email || ''}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* 2. Menu Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{OWNER_STRINGS.SIDEBAR.MENU_SECTION}</Text>
      </View>

      {/* 3. Danh sách Menu Items */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuList}
        bounces={false}
      >
        {menuItems.map((item) => {
          const isActive = activeRoute === item.routeName;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? theme.colors.brand[500] : '#334155'}
                  style={styles.menuIcon}
                />
                <Text
                  style={[
                    styles.menuTitle,
                    isActive ? styles.menuTitleActive : styles.menuTitleInactive,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </View>

              {item.badge !== undefined && item.badge > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 4. Nút Sign Out ở cuối */}
      <View style={styles.footerSection}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={theme.colors.red}
            style={styles.signOutIcon}
          />
          <Text style={styles.signOutText}>{OWNER_STRINGS.SIDEBAR.SIGN_OUT}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceMuted,
  },
  profileDetails: {
    marginLeft: theme.spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  emailText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.divider,
    marginVertical: theme.spacing.sm,
  },
  sectionHeader: {
    paddingVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.muted,
    letterSpacing: 0.8,
  },
  menuList: {
    paddingVertical: theme.spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radii.lg,
    marginVertical: 2,
  },
  menuItemActive: {
    backgroundColor: theme.colors.brand[100], // #E6F7F7
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuTitle: {
    fontSize: 14.5,
  },
  menuTitleActive: {
    color: theme.colors.brand[500],
    fontWeight: theme.typography.fontWeight.bold,
  },
  menuTitleInactive: {
    color: '#1E293B',
    fontWeight: theme.typography.fontWeight.medium,
  },
  badgeContainer: {
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.text.inverse,
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  footerSection: {
    paddingTop: theme.spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.radii.xl,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 14.5,
    fontWeight: theme.typography.fontWeight.bold,
  },
});

export default OwnerSidebarContent;
