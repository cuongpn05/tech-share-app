import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OnboardingScreen } from '../user/OnboardingScreen';
import OwnerDrawerNavigator from './OwnerDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import { HomeRoute } from './HomeRoute';
import OwnerMessagesScreen from '../screens/owner/OwnerMessagesScreen';
import OwnerPendingBookingsScreen from '../screens/owner/OwnerPendingBookingsScreen';
import ChatDetailScreen from '../screens/chat/ChatDetailScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import { BookingCreateScreen } from '../screens/booking/BookingCreateScreen';
import { DeviceDetailScreen } from '../screens/device/DeviceDetailScreen';
import { MyBookingsScreen } from '../screens/booking/MyBookingsScreen';
import { BookingDetailScreen } from '../screens/booking/BookingDetailScreen';
import { ProfileScreen } from '../screens/user/ProfileScreen';
import { EkycVerificationScreen } from '../screens/user/EkycVerificationScreen';
import { AiChatConsultant } from '../screens/ai/AiChatConsultant';
import { socketService } from '../services/socketService';
import { firebaseMessagingService } from '../services/firebaseMessagingService';
import { notificationService } from '../services/notificationService';
import { setAuthToken } from '../config/api';
import { navigationRef } from './navigationRef';
import { theme } from '../theme/tokens';
import { ScreenType } from '../types';

import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from 'react-native';

export { HomeRoute } from './HomeRoute';

const ONBOARDING_STORAGE_KEY = '@has_completed_onboarding';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Owner: undefined;
  Admin: undefined;
  Home: { initialTab?: ScreenType } | undefined;
  Profile: undefined;
  OwnerPendingBookings: undefined;
  EkycVerification: undefined;
  OwnerMessages: undefined;
  ChatDetail: { bookingId?: string; otherBookings?: any[] } | undefined;
  Notification: undefined;
  BookingCreate: { deviceId: string };
  DeviceDetail: { deviceId: string };
  MyBookings: undefined;
  BookingDetail: { bookingId: string };
  BookingRequestDetail: { bookingId: string };
  AiChatConsultant: undefined;
};


const Stack = createNativeStackNavigator<RootStackParamList>();

const DeviceDetailRoute = ({ route, navigation }: any) => (
  <DeviceDetailScreen
    deviceId={route.params.deviceId}
    onBack={() => navigation.goBack()}
    onRent={(deviceId) => navigation.navigate('BookingCreate', { deviceId })}
  />
);

const BookingCreateRoute = ({ route, navigation }: any) => (
  <BookingCreateScreen
    deviceId={route.params.deviceId}
    onBack={() => navigation.goBack()}
    onSuccess={() => navigation.navigate('Home', { initialTab: 'bookings' })}
    onNavigateToVerification={() => navigation.navigate('EkycVerification')}
    onNavigateToLogin={() => navigation.navigate('Login')}
  />
);

const MyBookingsRoute = ({ navigation }: any) => (
  <MyBookingsScreen
    onNavigateToBookingDetail={(bookingId) => navigation.navigate('BookingDetail', { bookingId })}
    onNavigateToDeviceDetail={(deviceId) => navigation.navigate('DeviceDetail', { deviceId })}
    onNavigateToBookingCreate={(deviceId) => navigation.navigate('BookingCreate', { deviceId })}
    onNavigateToHome={() => navigation.navigate('Home')}
  />
);

const BookingDetailRoute = ({ route, navigation }: any) => (
  <BookingDetailScreen
    bookingId={route.params.bookingId}
    onBack={() => navigation.goBack()}
    onNavigateToChat={(bookingId) => navigation.navigate('ChatDetail', { bookingId })}
    onNavigateToBookingCreate={(deviceId) => navigation.navigate('BookingCreate', { deviceId })}
  />
);

const AiChatConsultantRoute = ({ navigation }: any) => (
  <AiChatConsultant
    onBack={() => navigation.goBack()}
    onNavigateToDeviceDetail={(deviceId) =>
      navigation.navigate('BookingCreate', { deviceId })
    }
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

      // Khởi tạo thông báo đẩy Firebase Cloud Messaging (FCM)
      firebaseMessagingService.init(uid);

      // Tải và đồng bộ số lượng thông báo chưa đọc toàn cục
      notificationService.fetchUnreadCount(uid);
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

  const prevAuthRef = useRef<{ isAuthenticated: boolean; role?: string }>({
    isAuthenticated,
    role: user?.role,
  });

  // Tự động chuyển hướng chính xác đến trang của Role khi đăng nhập hoặc đăng xuất
  useEffect(() => {
    if (hasCompletedOnboarding === null) return;

    const prev = prevAuthRef.current;
    const isLoginEvent = !prev.isAuthenticated && isAuthenticated;
    const isLogoutEvent = prev.isAuthenticated && !isAuthenticated;
    const isRoleChangeEvent = isAuthenticated && prev.role !== user?.role;

    prevAuthRef.current = { isAuthenticated, role: user?.role };

    const executeRedirect = () => {
      if (!navigationRef.isReady()) return;
      try {
        if (isLoginEvent || isRoleChangeEvent) {
          const targetRoute: keyof RootStackParamList =
            user?.role === 'admin' ? 'Admin' : user?.role === 'owner' ? 'Owner' : 'Home';
          navigationRef.reset({
            index: 0,
            routes: [{ name: targetRoute }],
          });
        } else if (isLogoutEvent) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }
      } catch (err) {
        console.warn('[RootNavigator] Reset redirect skipped:', err);
      }
    };

    if (isLoginEvent || isLogoutEvent || isRoleChangeEvent) {
      const timer = setTimeout(executeRedirect, 150);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.role, hasCompletedOnboarding]);

  // Màn hình loading chờ kiểm tra AsyncStorage
  if (hasCompletedOnboarding === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  const getInitialRoute = (): keyof RootStackParamList => {
    if (!hasCompletedOnboarding) return 'Onboarding';
    if (isAuthenticated) {
      if (user?.role === 'admin') return 'Admin';
      if (user?.role === 'owner') return 'Owner';
      return 'Home';
    }
    return 'Home';
  };

  return (
    <Stack.Navigator initialRouteName={getInitialRoute()} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeviceDetail" component={DeviceDetailRoute} />
      {!hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding">
          {(props) => <OnboardingScreen {...props} onComplete={handleCompleteOnboarding} />}
        </Stack.Screen>
      ) : isAuthenticated ? (
        // ── PHÂN HỆ ĐÃ ĐĂNG NHẬP (Phân theo Role) ──────────────────────
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

          {/* Các màn hình chức năng khi đã đăng nhập */}
          <Stack.Screen name="OwnerPendingBookings" component={OwnerPendingBookingsScreen} />
          <Stack.Screen name="OwnerMessages" component={OwnerMessagesScreen} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="Notification" component={NotificationScreen} />
          <Stack.Screen name="Profile">
            {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.goBack()} />}
          </Stack.Screen>
          <Stack.Screen name="EkycVerification" component={EkycVerificationScreen} />
          <Stack.Screen name="BookingCreate" component={BookingCreateRoute} />
          <Stack.Screen name="MyBookings" component={MyBookingsRoute} />
          <Stack.Screen name="BookingDetail" component={BookingDetailRoute} />
          <Stack.Screen name="BookingRequestDetail" component={BookingDetailRoute} />
          <Stack.Screen
            name="AiChatConsultant"
            component={AiChatConsultantRoute}
          />
        </>
      ) : (
        // ── PHÂN HỆ KHÁCH CHƯA ĐĂNG NHẬP (Guest) ────────────────────────
        <>
          <Stack.Screen name="Home" component={HomeRoute} />
          <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
          <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
                onNavigateToRegister={() => props.navigation.navigate('Register')}
                onLoginSuccess={(role) => {
                  const targetRoute = role === 'admin' ? 'Admin' : role === 'owner' ? 'Owner' : 'Home';
                  if (navigationRef.isReady()) {
                    navigationRef.reset({
                      index: 0,
                      routes: [{ name: targetRoute }],
                    });
                  }
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Register">
            {(props) => (
              <RegisterScreen
                {...props}
                onNavigateToLogin={() => props.navigation.navigate('Login')}
                onRegisterSuccess={(role) => {
                  const targetRoute = role === 'admin' ? 'Admin' : role === 'owner' ? 'Owner' : 'Home';
                  if (navigationRef.isReady()) {
                    navigationRef.reset({
                      index: 0,
                      routes: [{ name: targetRoute }],
                    });
                  }
                }}
              />
            )}
          </Stack.Screen>

          {/* Các màn hình chức năng khách có thể bấm xem */}
          <Stack.Screen name="OwnerPendingBookings" component={OwnerPendingBookingsScreen} />
          <Stack.Screen name="OwnerMessages" component={OwnerMessagesScreen} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="Notification" component={NotificationScreen} />
          <Stack.Screen name="Profile">
            {({ navigation }) => <ProfileScreen navigation={navigation} onBack={() => navigation.goBack()} />}
          </Stack.Screen>
          <Stack.Screen name="EkycVerification" component={EkycVerificationScreen} />
          <Stack.Screen name="BookingCreate" component={BookingCreateRoute} />
          <Stack.Screen name="MyBookings" component={MyBookingsRoute} />
          <Stack.Screen name="BookingDetail" component={BookingDetailRoute} />
          <Stack.Screen name="BookingRequestDetail" component={BookingDetailRoute} />
          <Stack.Screen
            name="AiChatConsultant"
            component={AiChatConsultantRoute}
          />
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
