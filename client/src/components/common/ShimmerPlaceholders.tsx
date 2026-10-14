import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme/tokens';

interface ShimmerBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Khối Shimmer động với hiệu ứng nhịp thở / sóng mượt mà
 */
export const ShimmerBlock: React.FC<ShimmerBlockProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [animatedValue]);

  return (
    <Animated.View
      style={[
        styles.shimmerBase,
        {
          width: width as any,
          height,
          borderRadius,
          opacity: animatedValue,
        },
        style,
      ]}
    />
  );
};

/**
 * 1. Shimmer Skeleton cho danh sách cuộc trò chuyện (OwnerMessagesScreen)
 */
export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={`conv_skel_${i}`} style={styles.conversationCard}>
          {/* Avatar tròn */}
          <ShimmerBlock width={48} height={48} borderRadius={24} style={styles.avatar} />

          <View style={styles.cardContent}>
            {/* Hàng 1: Tên người gửi + Thời gian */}
            <View style={styles.topRow}>
              <ShimmerBlock width={130} height={15} borderRadius={4} />
              <ShimmerBlock width={45} height={12} borderRadius={4} />
            </View>

            {/* Hàng 2: Tên thiết bị / Badge đơn */}
            <View style={styles.middleRow}>
              <ShimmerBlock width={180} height={13} borderRadius={4} />
              <ShimmerBlock width={65} height={18} borderRadius={6} />
            </View>

            {/* Hàng 3: Đoạn trích tin nhắn gần nhất */}
            <ShimmerBlock width="80%" height={13} borderRadius={4} style={styles.snippet} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * 2. Shimmer Skeleton cho trung tâm thông báo (NotificationScreen)
 */
export const NotificationListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={`notif_skel_${i}`} style={styles.notifCard}>
          {/* Icon tròn */}
          <ShimmerBlock width={44} height={44} borderRadius={12} style={styles.iconBox} />

          <View style={styles.notifContent}>
            <View style={styles.notifHeader}>
              <ShimmerBlock width="65%" height={15} borderRadius={4} />
              <ShimmerBlock width={8} height={8} borderRadius={4} />
            </View>
            <ShimmerBlock width="95%" height={13} borderRadius={4} style={{ marginTop: 6 }} />
            <ShimmerBlock width="45%" height={13} borderRadius={4} style={{ marginTop: 4 }} />
            <ShimmerBlock width={70} height={11} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * 3. Shimmer Skeleton cho màn hình chat chi tiết (ChatDetailScreen)
 */
export const ChatMessagesSkeleton: React.FC = () => {
  return (
    <View style={styles.chatContainer}>
      {/* Tin nhắn đến bên trái */}
      <View style={styles.messageRowLeft}>
        <ShimmerBlock width={28} height={28} borderRadius={14} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
        <View style={styles.bubbleLeft}>
          <ShimmerBlock width={180} height={14} borderRadius={4} />
          <ShimmerBlock width={120} height={14} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Tin nhắn gửi bên phải */}
      <View style={styles.messageRowRight}>
        <View style={styles.bubbleRight}>
          <ShimmerBlock width={150} height={14} borderRadius={4} />
        </View>
      </View>

      {/* Tin nhắn đến bên trái */}
      <View style={styles.messageRowLeft}>
        <ShimmerBlock width={28} height={28} borderRadius={14} style={{ marginRight: 8, alignSelf: 'flex-end' }} />
        <View style={styles.bubbleLeft}>
          <ShimmerBlock width={220} height={14} borderRadius={4} />
          <ShimmerBlock width={160} height={14} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Tin nhắn gửi bên phải */}
      <View style={styles.messageRowRight}>
        <View style={styles.bubbleRight}>
          <ShimmerBlock width={190} height={14} borderRadius={4} />
          <ShimmerBlock width={90} height={14} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: '#E2E8F0',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatar: {
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  snippet: {
    marginTop: 8,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBox: {
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'flex-end',
  },
  messageRowLeft: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  bubbleLeft: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bubbleRight: {
    backgroundColor: '#E6F7F7',
    padding: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
});
