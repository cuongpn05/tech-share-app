import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';
import { HomeRoute } from './HomeRoute';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import OwnerMessagesScreen from '../screens/owner/OwnerMessagesScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import OwnerSidebarContent from './OwnerSidebarContent';
import { theme } from '../theme/tokens';

const Drawer = createDrawerNavigator();

// Màn hình placeholder sang trọng cho các phân hệ tính năng con của Owner
const OwnerPlaceholderScreen: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle = 'Phân hệ đang được hoàn thiện',
}) => (
  <View style={styles.placeholderContainer}>
    <View style={styles.placeholderCard}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
    </View>
  </View>
);

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
        {() => (
          <OwnerPlaceholderScreen
            title="Revenue & Analytics"
            subtitle="Phân tích chuyên sâu doanh thu và lượt thuê thiết bị"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerPendingBookings">
        {() => (
          <OwnerPlaceholderScreen
            title="Pending Bookings"
            subtitle="Danh sách 2 yêu cầu thuê thiết bị đang chờ xác nhận"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerMessages" component={OwnerMessagesScreen} />

      <Drawer.Screen name="OwnerDeviceInventory">
        {() => (
          <OwnerPlaceholderScreen
            title="My Device Inventory"
            subtitle="Kho 20 thiết bị công nghệ đang quản lý"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerListDevice">
        {() => (
          <OwnerPlaceholderScreen
            title="List New Devices"
            subtitle="Biểu mẫu đăng tải thiết bị cho thuê mới"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerWallet">
        {() => (
          <OwnerPlaceholderScreen
            title="Revenue & Deposit Wallet"
            subtitle="Quản lý số dư khả dụng và tiền cọc ký quỹ Escrow"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerAiAssistant">
        {() => (
          <OwnerPlaceholderScreen
            title="AI Assistant"
            subtitle="Trợ lý thông minh định giá thiết bị và tối ưu doanh thu"
          />
        )}
      </Drawer.Screen>

      <Drawer.Screen name="RenterMode">
        {({ navigation }) => <HomeRoute onReturnToOwner={() => navigation.navigate('OwnerDashboard')} />}
      </Drawer.Screen>

      <Drawer.Screen name="OwnerNotifications" component={NotificationScreen} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
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
  },
});

export default OwnerDrawerNavigator;
