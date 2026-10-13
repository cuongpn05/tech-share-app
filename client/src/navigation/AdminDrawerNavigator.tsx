import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminSidebarContent from './AdminSidebarContent';
import { theme } from '../theme/tokens';

const Drawer = createDrawerNavigator();

// Placeholder cho các phân hệ con của Admin Hub
const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderTitle}>{title}</Text>
    <Text style={styles.placeholderSubtitle}>Tính năng đang được phát triển</Text>
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
        overlayColor: 'rgba(15, 23, 42, 0.4)',
      }}
    >
      <Drawer.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Drawer.Screen name="UserManagement">
        {() => <PlaceholderScreen title="User Management" />}
      </Drawer.Screen>
      <Drawer.Screen name="DeviceModeration">
        {() => <PlaceholderScreen title="Device Moderation" />}
      </Drawer.Screen>
      <Drawer.Screen name="DepositDisputes">
        {() => <PlaceholderScreen title="Deposit Disputes" />}
      </Drawer.Screen>
      <Drawer.Screen name="EkycReviews">
        {() => <PlaceholderScreen title="eKYC Reviews" />}
      </Drawer.Screen>
      <Drawer.Screen name="VouchersPromotions">
        {() => <PlaceholderScreen title="Vouchers & Promotions" />}
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
