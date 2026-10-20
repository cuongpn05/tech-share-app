import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../store';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MyBookingsScreen } from '../screens/booking/MyBookingsScreen';
import { AiCompareScreen } from '../screens/ai/AiCompareScreen';
import { BottomTabNavigator } from '../components/navigation/BottomTabNavigator';
import { chatService } from '../services/chatService';
import { socketService } from '../services/socketService';
import { ProfileScreen } from '../screens/user/ProfileScreen';
import { theme } from '../constants/theme';
import { ScreenType } from '../types';

export interface HomeRouteProps {
  navigation?: any;
  route?: any;
  onReturnToOwner?: () => void;
}

export function HomeRoute({
  navigation,
  route,
  onReturnToOwner: propOnReturnToOwner,
}: HomeRouteProps = {}) {
  const insets = useSafeAreaInsets();
  const onReturnToOwner = propOnReturnToOwner || route?.params?.onReturnToOwner;
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeTab, setActiveTab] = useState<ScreenType>(route?.params?.initialTab || 'home');

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const convs = await chatService.getConversations();
      if (Array.isArray(convs)) {
        const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setUnreadMessages(total);
      }
    } catch {
      // Bỏ qua nếu chưa kết nối server
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const unsubNew = socketService.onNewMessage(() => {
      loadUnreadCount();
    });
    const unsubRead = socketService.onMessagesRead(() => {
      loadUnreadCount();
    });

    return () => {
      unsubNew();
      unsubRead();
    };
  }, [loadUnreadCount]);

  const handleNavigateToChat = () => {
    if (navigation?.navigate) {
      navigation.navigate('OwnerMessages');
    }
  };

  const handleNavigateToNotifications = () => {
    if (navigation?.navigate) {
      navigation.navigate('Notification');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'bookings' ? (
        !isAuthenticated ? (
          <View style={styles.guestContainer}>
            <View style={styles.guestIconCircle}>
              <Ionicons name="receipt-outline" size={44} color={theme.primary} />
            </View>
            <Text style={styles.guestTitle}>Đơn thuê thiết bị</Text>
            <Text style={styles.guestSubtitle}>
              Vui lòng đăng nhập tài khoản để theo dõi tiến độ và quản lý các đơn thuê thiết bị công nghệ.
            </Text>
            <TouchableOpacity
              style={styles.guestLoginButton}
              onPress={() => navigation?.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.guestLoginButtonText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MyBookingsScreen
            onNavigateToBookingDetail={(bookingId) => {
              if (navigation?.navigate) {
                navigation.navigate('BookingDetail', { bookingId });
              }
            }}
            onNavigateToDeviceDetail={(deviceId) => {
              if (navigation?.navigate) {
                navigation.navigate('DeviceDetail', { deviceId });
              }
            }}
            onNavigateToBookingCreate={(deviceId) => {
              if (navigation?.navigate) {
                navigation.navigate('BookingCreate', { deviceId });
              }
            }}
            onNavigateToHome={() => setActiveTab('home')}
          />
        )
      ) : activeTab === 'profile' ? (
        <ProfileScreen
          navigation={navigation}
          onBack={() => setActiveTab('home')}
        />
      ) : (
        <HomeScreen
          navigation={navigation}
          onNavigateToLogin={() => {
            if (navigation?.navigate) {
              navigation.navigate('Login');
            }
          }}
          showOwnerDashboard={!!onReturnToOwner}
          onNavigateToOwnerDashboard={onReturnToOwner}
          onNavigateToChat={handleNavigateToChat}
          onNavigateToNotifications={handleNavigateToNotifications}
          onNavigateToDeviceDetail={(deviceId) => {
            if (navigation?.navigate) {
              navigation.navigate('DeviceDetail', { deviceId });
            }
          }}
          unreadMessages={unreadMessages}
          unreadNotifications={unreadMessages}
        />
      )}
      <BottomTabNavigator
        activeTab={activeTab}
        enabledTabs={['home', 'bookings', 'profile']}
        onTabPress={(tab) => setActiveTab(tab)}
        safeAreaBottom={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.background,
  },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
    maxWidth: 320,
  },
  guestLoginButton: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  guestLoginButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
