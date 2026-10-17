import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MyBookingsScreen } from '../screens/booking/MyBookingsScreen';
import { AiCompareScreen } from '../screens/ai/AiCompareScreen';
import { BottomTabNavigator } from '../components/navigation/BottomTabNavigator';
import { chatService } from '../services/chatService';
import { socketService } from '../services/socketService';
import { ProfileScreen } from '../screens/user/ProfileScreen';
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
        <MyBookingsScreen
          onNavigateToBookingDetail={(bookingId) => {
            if (navigation?.navigate) {
              navigation.navigate('BookingDetail', { bookingId });
            }
          }}
          onNavigateToDeviceDetail={(deviceId) => {
            if (navigation?.navigate) {
              navigation.navigate('BookingCreate', { deviceId });
            }
          }}
          onNavigateToBookingCreate={(deviceId) => {
            if (navigation?.navigate) {
              navigation.navigate('BookingCreate', { deviceId });
            }
          }}
          onNavigateToHome={() => setActiveTab('home')}
        />
      ) : activeTab === 'profile' ? (
        <ProfileScreen
          navigation={navigation}
          onBack={() => setActiveTab('home')}
        />
      ) : (
        <HomeScreen
          showOwnerDashboard={!!onReturnToOwner}
          onNavigateToOwnerDashboard={onReturnToOwner}
          onNavigateToChat={handleNavigateToChat}
          onNavigateToNotifications={handleNavigateToNotifications}
          onNavigateToDeviceDetail={(deviceId) => {
            if (navigation?.navigate) {
              navigation.navigate('BookingCreate', { deviceId });
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
