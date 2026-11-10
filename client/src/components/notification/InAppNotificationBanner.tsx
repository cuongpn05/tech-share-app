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
  type?: 'message' | 'booking';
  status?: string;
  bookingCode?: string;
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

    // Tự động ẩn sau 5 giây
    timerRef.current = setTimeout(() => {
      dismissBanner();
    }, 5000);
  };

  useEffect(() => {
    // 1. Lắng nghe tin nhắn mới từ socket
    const unsubMsg = socketService.onNewMessage((msg: ChatMessage) => {
      if (currentUserId && String(msg.senderId) === String(currentUserId)) return;

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
        senderAvatar: msg.senderAvatar || '',
        text: snippet,
        type: 'message',
      });
    });

    // 2. Lắng nghe thông báo đẩy dạng booking notification event
    const unsubNotif = socketService.onNotification((notif) => {
      if (!notif) return;
      const bId = notif.data?.bookingId || notif.relatedId;
      if (!bId) return;

      const currentActiveBooking = socketService.getActiveBookingId();
      if (currentActiveBooking && currentActiveBooking === bId) return;

      const isBooking = notif.type === 'order' || notif.type === 'booking' || Boolean(bId);

      showBanner({
        id: notif._id || `notif_${Date.now()}`,
        bookingId: bId,
        senderName: notif.title || 'TechShare Booking Update',
        senderAvatar: notif.data?.senderAvatar || '',
        text: notif.body || 'You have a new update regarding your rental order',
        type: isBooking ? 'booking' : 'message',
        status: (notif.data as any)?.status,
        bookingCode: (notif.data as any)?.bookingCode,
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
    if (!activeBanner) return;
    const { bookingId, type, status } = activeBanner;
    dismissBanner();
    if (!bookingId) return;

    if (type === 'booking') {
      if (currentUser?.role === 'owner' && status === 'pending') {
        navigate('OwnerPendingBookings');
      } else {
        navigate('BookingDetail', { bookingId });
      }
    } else {
      navigate('ChatDetail', { bookingId });
    }
  };

  const topOffset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 36
  );

  const isBookingBanner = activeBanner.type === 'booking';

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
        style={[styles.card, isBookingBanner ? styles.cardBooking : styles.cardMessage]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Leading Avatar / Icon */}
        {isBookingBanner ? (
          <View style={[styles.avatar, styles.iconBadgeBooking]}>
            <Ionicons name="receipt" size={20} color="#2DD4BF" />
          </View>
        ) : activeBanner.senderAvatar ? (
          <Image
            source={{ uri: activeBanner.senderAvatar }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#0D9488" />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.tagGroup}>
              <View style={[styles.typePill, isBookingBanner ? styles.typePillBooking : styles.typePillMessage]}>
                <Ionicons
                  name={isBookingBanner ? 'receipt-outline' : 'chatbubble-outline'}
                  size={10}
                  color={isBookingBanner ? '#2DD4BF' : '#60A5FA'}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.typeText, isBookingBanner ? styles.typeTextBooking : styles.typeTextMessage]}>
                  {isBookingBanner ? 'BOOKING' : 'MESSAGE'}
                </Text>
              </View>
              <Text style={styles.timeTag}>Just now</Text>
            </View>

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

          <Text style={styles.messageText} numberOfLines={2}>
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
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
  },
  cardBooking: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderLeftWidth: 4,
    borderLeftColor: '#2DD4BF',
  },
  cardMessage: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    marginRight: 12,
  },
  iconBadgeBooking: {
    backgroundColor: 'rgba(13, 148, 136, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  typePillBooking: {
    backgroundColor: 'rgba(13, 148, 136, 0.25)',
  },
  typePillMessage: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  typeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  typeTextBooking: {
    color: '#2DD4BF',
  },
  typeTextMessage: {
    color: '#93C5FD',
  },
  timeTag: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  closeBtn: {
    padding: 2,
  },
  senderName: {
    fontSize: 14,
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
