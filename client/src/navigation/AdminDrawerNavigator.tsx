import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import DeviceModerationListScreen from '../screens/admin/DeviceModerationListScreen';
import DeviceModerationDetailScreen from '../screens/admin/DeviceModerationDetailScreen';
import { UserManagementScreen } from '../screens/admin/UserManagementScreen';
import AdminEkycListScreen from '../screens/admin/AdminEkycListScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import AdminSidebarContent from './AdminSidebarContent';
import { theme } from '../theme/tokens';

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
      <Drawer.Screen name="EkycReviews">
        {({ navigation }) => <AdminEkycListScreen navigation={navigation} initialCategory="renter" />}
      </Drawer.Screen>
      <Drawer.Screen name="OwnerEkycReviews">
        {({ navigation }) => <AdminEkycListScreen navigation={navigation} initialCategory="owner" />}
      </Drawer.Screen>
      <Drawer.Screen name="Profile">
        {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.navigate('AdminDashboard')} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

export default AdminDrawerNavigator;
