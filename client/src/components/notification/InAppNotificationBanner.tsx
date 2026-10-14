import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { socketService } from '../../services/socketService';
import { useAppSelector } from '../../store';
import { ChatMessage } from '../../types';
import { navigate } from '../../navigation/navigationRef';

interface BannerData {
  id: string;
  bookingId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
}

export const InAppNotificationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id;

  const [activeBanner, setActiveBanner] = useState<BannerData | null>(null);

  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBannerKeyRef = useRef<string>('');
  const lastBannerTimeRef = useRef<number>(0);

  const dismissBanner = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveBanner(null);
    });
  };

  const showBanner = (data: BannerData) => {
    const now = Date.now();
    const bannerKey = `${data.bookingId}_${data.id || data.text}`;
    if (lastBannerKeyRef.current === bannerKey && now - lastBannerTimeRef.current < 2500) {
      return;
    }
    lastBannerKeyRef.current = bannerKey;
    lastBannerTimeRef.current = now;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setActiveBanner(data);

    // Rung nhẹ thông báo
    try {
      Vibration.vibrate(150);
    } catch {}

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Tự động ẩn sau 4.5 giây
    timerRef.current = setTimeout(() => {
      dismissBanner();
    }, 4500);
  };

  useEffect(() => {
    // 1. Lắng nghe tin nhắn mới từ socket
    const unsubMsg = socketService.onNewMessage((msg: ChatMessage) => {
      // Bỏ qua nếu là tin do chính mình gửi
      if (currentUserId && String(msg.senderId) === String(currentUserId)) return;

      // Bỏ qua nếu người dùng đang ở trong chính phòng chat này
      const currentActiveBooking = socketService.getActiveBookingId();
      if (currentActiveBooking && currentActiveBooking === msg.bookingId) return;

      const snippet =
        msg.text ||
        (msg.messageType === 'image'
          ? 'Đã gửi một hình ảnh'
          : msg.messageType === 'location'
          ? 'Đã chia sẻ vị trí GPS'
          : 'Tin nhắn mới');

      showBanner({
        id: msg._id,
        bookingId: msg.bookingId,
        senderName: msg.senderName || 'Tin nhắn mới',
        senderAvatar:
          msg.senderAvatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
        text: snippet,
      });
    });

    // 2. Lắng nghe thông báo đẩy dạng notification event
    const unsubNotif = socketService.onNotification((notif) => {
      if (!notif) return;
      const bId = notif.data?.bookingId || notif.relatedId;
      if (!bId) return;

      const currentActiveBooking = socketService.getActiveBookingId();
      if (currentActiveBooking && currentActiveBooking === bId) return;

      showBanner({
        id: notif._id || `notif_${Date.now()}`,
        bookingId: bId,
        senderName: notif.data?.senderName || notif.title || 'TechShare',
        senderAvatar:
          notif.data?.senderAvatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
        text: notif.body || 'Bạn có tin nhắn mới',
      });
    });

    return () => {
      unsubMsg();
      unsubNotif();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentUserId]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -20 || gesture.vy < -0.5) {
          dismissBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!activeBanner) return null;

  const handlePress = () => {
    const bookingId = activeBanner.bookingId;
    dismissBanner();
    if (bookingId) {
      navigate('ChatDetail', { bookingId });
    }
  };

  const topOffset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 36
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: activeBanner.senderAvatar }}
          style={styles.avatar}
        />

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.appName}>TechShare • Vừa xong</Text>
            <TouchableOpacity
              onPress={dismissBanner}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.senderName} numberOfLines={1}>
            {activeBanner.senderName}
          </Text>

          <Text style={styles.messageText} numberOfLines={1}>
            {activeBanner.text}
          </Text>
        </View>

        <View style={styles.actionIconBox}>
          <Ionicons name="chevron-forward" size={18} color="#2DD4BF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999999,
    elevation: 999999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A', // Sleek dark card
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#334155',
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appName: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2DD4BF', // Brand teal
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 2,
  },
  senderName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 12.5,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  actionIconBox: {
    marginLeft: 8,
    padding: 4,
  },
});

export default InAppNotificationBanner;
