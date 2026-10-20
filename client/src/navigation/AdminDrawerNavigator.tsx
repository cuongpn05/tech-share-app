import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import DeviceModerationListScreen from '../screens/admin/DeviceModerationListScreen';
import DeviceModerationDetailScreen from '../screens/admin/DeviceModerationDetailScreen';
import { UserManagementScreen } from '../screens/admin/UserManagementScreen';
import AdminEkycListScreen from '../screens/admin/AdminEkycListScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import AdminSidebarContent from './AdminSidebarContent';
import { theme } from '../theme/tokens';
import { ADMIN_STRINGS } from '../constants/adminStrings';


const Drawer = createDrawerNavigator();
const ModerationStack = createNativeStackNavigator();

// Stack điều hướng giữa Danh sách kiểm duyệt và Chi tiết kiểm duyệt (UC-A03, UC-A04)
const DeviceModerationStackNavigator: React.FC = () => {
  return (
    <ModerationStack.Navigator screenOptions={{ headerShown: false }}>
      <ModerationStack.Screen
        name="DeviceModerationList"
        component={DeviceModerationListScreen}
      />
      <ModerationStack.Screen
        name="DeviceModerationDetail"
        component={DeviceModerationDetailScreen}
      />
    </ModerationStack.Navigator>
  );
};

// Placeholder cho các phân hệ con của Admin Hub
const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderTitle}>{title}</Text>
    <Text style={styles.placeholderSubtitle}>{ADMIN_STRINGS.COMMON.COMING_SOON}</Text>
  </View>
);

export const AdminDrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="AdminDashboard"
      drawerContent={(props) => (
        <AdminSidebarContent
          {...props}
          activeRoute={props.state.routes[props.state.index].name}
        />
      )}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 310,
          backgroundColor: theme.colors.surface,
        },
        drawerType: 'front',
        overlayColor: theme.colors.overlay,
      }}
    >
      <Drawer.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Drawer.Screen
        name="UserManagement"
        component={UserManagementScreen}
      />

      <Drawer.Screen name="DeviceModeration" component={DeviceModerationStackNavigator} />
      <Drawer.Screen name="DepositDisputes">
        {() => <PlaceholderScreen title="Deposit Disputes" />}
      </Drawer.Screen>
      <Drawer.Screen name="EkycReviews" component={AdminEkycListScreen} />
      <Drawer.Screen name="VouchersPromotions">
        {() => <PlaceholderScreen title="Vouchers & Promotions" />}
      </Drawer.Screen>
      <Drawer.Screen name="Profile">
        {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.navigate('AdminDashboard')} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  placeholderTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
});

export default AdminDrawerNavigator;
