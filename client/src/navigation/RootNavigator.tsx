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

import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, Alert } from 'react-native';

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
    onNavigateToLogin={() => navigation.navigate('Login')}
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

  // Điều hướng: Role guest hoặc renter vào thẳng Home sau khi onboarding xong
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!hasCompletedOnboarding) return 'Onboarding';
    if (isAuthenticated) {
      if (user?.role === 'admin') return 'Admin';
      if (user?.role === 'owner') return 'Owner';
      return 'Home';
    }
    // Role guest: vào thẳng trang Home
    return 'Home';
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
      ) : (
        <>
          {/* Màn hình chính phân theo role nếu đã đăng nhập, hoặc Home cho guest/renter */}
          {isAuthenticated && user?.role === 'admin' ? (
            <>
              <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
              <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
              <Stack.Screen name="Home" component={HomeRoute} />
            </>
          ) : isAuthenticated && user?.role === 'owner' ? (
            <>
              <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
              <Stack.Screen name="Home" component={HomeRoute} />
              <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeRoute} />
              {isAuthenticated && (
                <>
                  <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
                  <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
                </>
              )}
            </>
          )}

          {/* Màn hình Login luôn có trong Stack để người dùng guest bấm đăng nhập bất cứ lúc nào */}
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* Các màn hình chức năng */}
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
  guestPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  guestIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  guestPromptTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  guestPromptSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
    maxWidth: 320,
  },
  guestLoginButton: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: theme.colors.brand[500],
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  guestLoginButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  guestBackButton: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestBackButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
});

export default RootNavigator;
