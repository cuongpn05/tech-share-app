import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store';
import { LoginScreen } from '../screens/auth/LoginScreen';
import OwnerDrawerNavigator from './OwnerDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import { HomeRoute } from './HomeRoute';

export { HomeRoute } from './HomeRoute';

export type RootStackParamList = {
  Login: undefined;
  Owner: undefined;
  Admin: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  // Điều hướng dựa trên trạng thái đăng nhập và phân role: admin, owner, renter
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!isAuthenticated) return 'Login';
    if (user?.role === 'admin') return 'Admin';
    if (user?.role === 'owner') return 'Owner';
    return 'Home'; // Mặc định role renter
  };

  return (
    <Stack.Navigator
      key={isAuthenticated ? `auth-${user?.role || 'renter'}` : 'guest'}
      initialRouteName={getInitialRoute()}
      screenOptions={{ headerShown: false }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          {user?.role === 'admin' ? (
            <>
              <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
              <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
              <Stack.Screen name="Home" component={HomeRoute} />
            </>
          ) : user?.role === 'owner' ? (
            <>
              <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
              <Stack.Screen name="Home" component={HomeRoute} />
              <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeRoute} />
              <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
              <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
