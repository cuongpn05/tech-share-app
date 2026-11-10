import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../store';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MapScreen } from '../screens/map/MapScreen';
import { MyBookingsScreen } from '../screens/booking/MyBookingsScreen';
import { AiCompareScreen } from '../screens/ai/AiCompareScreen';
import { BottomTabNavigator } from '../components/navigation/BottomTabNavigator';
import { GuestPromptView } from '../components/common/GuestPromptView';
import { chatService } from '../services/chatService';
import { socketService } from '../services/socketService';
import { notificationService } from '../services/notificationService';
import { ProfileScreen } from '../screens/user/ProfileScreen';
import { STRINGS } from '../constants/strings';
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
  const { isAuthenticated, user: currentUser } = useAppSelector((state) => state.auth);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(
    notificationService.getUnreadCountCached()
  );
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

    const userId = currentUser?._id || (currentUser as any)?.id;
    if (userId) {
      notificationService.fetchUnreadCount(userId);
    }
    const unsubNotifCount = notificationService.onUnreadCountChange((count) => {
      setUnreadNotifications(count);
    });
    const unsubNotif = socketService.onNotification(() => {
      const uId = currentUser?._id || (currentUser as any)?.id;
      if (uId) {
        notificationService.fetchUnreadCount(uId);
      }
    });

    return () => {
      unsubNew();
      unsubRead();
      unsubNotifCount();
      unsubNotif();
    };
  }, [loadUnreadCount, currentUser]);

  useFocusEffect(
    useCallback(() => {
      const userId = currentUser?._id || (currentUser as any)?.id;
      if (userId) {
        notificationService.fetchUnreadCount(userId);
      }
    }, [currentUser])
  );

  useEffect(() => {
    const userId = currentUser?._id || (currentUser as any)?.id;
    if (userId) {
      notificationService.fetchUnreadCount(userId);
    }
  }, [activeTab, currentUser]);

  const handleNavigateToChat = () => {
    if (navigation?.navigate) {
      navigation.navigate('Messages');
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
          <GuestPromptView
            icon="receipt-outline"
            title={STRINGS.MY_BOOKINGS.GUEST_TITLE}
            subtitle={STRINGS.MY_BOOKINGS.GUEST_SUBTITLE}
            buttonText={STRINGS.MY_BOOKINGS.GUEST_LOGIN_BUTTON}
            onLoginPress={() => navigation?.navigate('Login')}
          />
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
      ) : activeTab === 'map' ? (
        <MapScreen
          onNavigateToDeviceDetail={(deviceId) => navigation?.navigate('DeviceDetail', { deviceId })}
          onNavigateToOwnerProfile={(ownerId) => navigation?.navigate('OwnerProfile', { ownerId })}
        />
      ) : activeTab === 'compare' ? (
        <AiCompareScreen />
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
          onNavigateToWishlist={() => navigation?.navigate('Wishlist')}
          onNavigateToChat={handleNavigateToChat}
          onNavigateToAiConsultant={() => navigation?.navigate('AiChatConsultant')}
          onNavigateToNotifications={handleNavigateToNotifications}
          onNavigateToDeviceDetail={(deviceId) => {
            if (navigation?.navigate) {
              navigation.navigate('DeviceDetail', { deviceId });
            }
          }}
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
        />
      )}
      <BottomTabNavigator
        activeTab={activeTab}
        enabledTabs={['home', 'bookings', 'map', 'compare', 'profile']}
        onTabPress={(tab) => setActiveTab(tab)}
        safeAreaBottom={insets.bottom}
      />
    </View>
  );
}
