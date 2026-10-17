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
import OwnerMessagesScreen from '../screens/owner/OwnerMessagesScreen';
import ChatDetailScreen from '../screens/chat/ChatDetailScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import { BookingCreateScreen } from '../screens/booking/BookingCreateScreen';
import { MyBookingsScreen } from '../screens/booking/MyBookingsScreen';
import { ProfileScreen } from '../screens/user/ProfileScreen';
import { socketService } from '../services/socketService';
import { setAuthToken } from '../config/api';
import { theme } from '../theme/tokens';
import { ScreenType } from '../types';

export { HomeRoute } from './HomeRoute';

const ONBOARDING_STORAGE_KEY = '@has_completed_onboarding';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Owner: undefined;
  Admin: undefined;
  Home: { initialTab?: ScreenType } | undefined;
  Profile: undefined;
  OwnerMessages: undefined;
  ChatDetail: { bookingId?: string; otherBookings?: any[] } | undefined;
  Notification: undefined;
  BookingCreate: { deviceId: string };
  MyBookings: undefined;
  BookingDetail: { bookingId: string };
};


const Stack = createNativeStackNavigator<RootStackParamList>();

const BookingCreateRoute = ({ route, navigation }: any) => (
  <BookingCreateScreen
    deviceId={route.params.deviceId}
    onBack={() => navigation.goBack()}
    onSuccess={() => navigation.navigate('Home', { initialTab: 'bookings' })}
    onNavigateToVerification={() => navigation.navigate('Home')}
  />
);

const MyBookingsRoute = ({ navigation }: any) => (
  <MyBookingsScreen
    onNavigateToBookingDetail={(bookingId) => navigation.navigate('BookingDetail', { bookingId })}
    onNavigateToDeviceDetail={(deviceId) => navigation.navigate('BookingCreate', { deviceId })}
    onNavigateToBookingCreate={(deviceId) => navigation.navigate('BookingCreate', { deviceId })}
    onNavigateToHome={() => navigation.navigate('Home')}
  />
);

export function RootNavigator() {

  const { isAuthenticated, user, token } = useAppSelector((state) => state.auth);
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
    if (isAuthenticated && token) {
      setAuthToken(token);
    }
    const uid = user?._id || (user as any)?.id;
    if (isAuthenticated && uid) {
      socketService.connect(uid);
    }
  }, [isAuthenticated, user, token]);

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
          <Stack.Screen name="OwnerMessages" component={OwnerMessagesScreen} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="Notification" component={NotificationScreen} />
          <Stack.Screen name="Profile">
            {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.goBack()} />}
          </Stack.Screen>
          <Stack.Screen name="BookingCreate" component={BookingCreateRoute} />
          <Stack.Screen name="MyBookings" component={MyBookingsRoute} />
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
