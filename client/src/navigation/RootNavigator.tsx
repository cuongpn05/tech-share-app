import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../user/OnboardingScreen';
import OwnerDrawerNavigator from './OwnerDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import { HomeRoute } from './HomeRoute';
import { socketService } from '../services/socketService';
import { theme } from '../theme/tokens';

export { HomeRoute } from './HomeRoute';

const ONBOARDING_STORAGE_KEY = '@has_completed_onboarding';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Owner: undefined;
  Admin: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        setHasCompletedOnboarding(value === 'true');
      } catch (error) {
        console.error('Failed to read onboarding status:', error);
        setHasCompletedOnboarding(true); // Fallback: không chặn người dùng nếu storage lỗi
      }
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      socketService.connect(user._id);
    }
  }, [isAuthenticated, user?._id]);

  const handleCompleteOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
    }
    setHasCompletedOnboarding(true);
  };

  // Màn hình loading chờ kiểm tra AsyncStorage
  if (hasCompletedOnboarding === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  // Điều hướng dựa trên trạng thái onboarding, đăng nhập và phân role: admin, owner, renter
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!hasCompletedOnboarding) return 'Onboarding';
    if (!isAuthenticated) return 'Login';
    if (user?.role === 'admin') return 'Admin';
    if (user?.role === 'owner') return 'Owner';
    return 'Home'; // Mặc định role renter
  };

  return (
    <Stack.Navigator
      key={!hasCompletedOnboarding ? 'onboarding' : isAuthenticated ? `auth-${user?.role || 'renter'}` : 'guest'}
      initialRouteName={getInitialRoute()}
      screenOptions={{ headerShown: false }}
    >
      {!hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding">
          {(props) => <OnboardingScreen {...props} onComplete={handleCompleteOnboarding} />}
        </Stack.Screen>
      ) : !isAuthenticated ? (
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

export default RootNavigator;
