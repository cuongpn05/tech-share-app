import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HomeRoute } from './HomeRoute';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import { PostDeviceScreen } from '../screens/device/PostDeviceScreen';
import OwnerMessagesScreen from '../screens/owner/OwnerMessagesScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import OwnerSidebarContent from './OwnerSidebarContent';
import { theme } from '../theme/tokens';

const Drawer = createDrawerNavigator();

// Màn hình placeholder sang trọng cho các phân hệ tính năng con của Owner
const OwnerPlaceholderScreen: React.FC<{
  title: string;
  subtitle?: string;
  description?: string;
  navigation?: any;
}> = ({
  title,
  subtitle = 'Phân hệ đang được hoàn thiện',
  description = 'Tính năng đang được phát triển và sẽ sớm ra mắt.',
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  return (
    <View style={[styles.screenContainer, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={styles.headerButton}
          onPress={() => navigation?.openDrawer?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.placeholderContainer}>
        <View style={styles.placeholderCard}>
          <Ionicons
            name="construct-outline"
            size={44}
            color={theme.colors.brand[500]}
            style={{ marginBottom: 14 }}
          />
          <Text style={styles.placeholderTitle}>{title}</Text>
          <Text style={styles.placeholderSubtitle}>{description}</Text>
        </View>
      </View>
    </View>
  );
};

export const OwnerDrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="OwnerDashboard"
      drawerContent={(props) => (
        <OwnerSidebarContent
          {...props}
          activeRoute={props.state.routes[props.state.index].name}
        />
      )}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 320,
          backgroundColor: theme.colors.surface,
        },
        drawerType: 'front',
        overlayColor: 'rgba(15, 23, 42, 0.45)',
      }}
    >
      <Drawer.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />

      <Drawer.Screen name="OwnerRevenueAnalytics">
        {({ navigation }: any) => (
          <OwnerPlaceholderScreen
            title="Revenue & Analytics"
            subtitle="Phân tích chuyên sâu doanh thu và lượt thuê thiết bị"
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerPendingBookings">
        {({ navigation }: any) => (
          <OwnerPlaceholderScreen
            title="Pending Bookings"
            subtitle="Quản lý và phê duyệt các yêu cầu đặt thuê thiết bị"
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerMessages" component={OwnerMessagesScreen} />

      <Drawer.Screen name="OwnerDeviceInventory">
        {({ navigation }: any) => (
          <OwnerPlaceholderScreen
            title="My Device Inventory"
            subtitle="Quản lý và theo dõi danh mục thiết bị công nghệ của bạn"
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerListDevice">
        {({ navigation, route }: any) => (
          <PostDeviceScreen
            accessToken={route?.params?.accessToken ?? ''}
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerWallet">
        {({ navigation }: any) => (
          <OwnerPlaceholderScreen
            title="Revenue & Deposit Wallet"
            subtitle="Quản lý số dư khả dụng và tiền cọc ký quỹ Escrow"
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerAiAssistant">
        {({ navigation }: any) => (
          <OwnerPlaceholderScreen
            title="AI Assistant"
            subtitle="Trợ lý thông minh định giá thiết bị và tối ưu doanh thu"
            navigation={navigation}
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="RenterMode">
        {({ navigation }) => <HomeRoute onReturnToOwner={() => navigation.navigate('OwnerDashboard')} />}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerNotifications" component={NotificationScreen} />
      <Drawer.Screen name="Profile">
        {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.navigate('OwnerDashboard')} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: 19,
    fontWeight: theme.typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: theme.colors.text.muted,
    fontSize: 12.5,
    marginTop: 2,
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  placeholderCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  placeholderTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.muted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});

export default OwnerDrawerNavigator;
