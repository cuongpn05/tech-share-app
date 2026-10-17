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

/**
 * 4. Shimmer Skeleton cho danh sách kiểm duyệt thiết bị (DeviceModerationListScreen)
 */
export const DeviceModerationListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={`mod_skel_${i}`} style={styles.moderationCard}>
          {/* Thông tin trên: Thumbnail 64x64 + Cột nội dung */}
          <View style={styles.moderationTopRow}>
            <ShimmerBlock width={64} height={64} borderRadius={10} style={styles.moderationThumb} />

            <View style={styles.moderationContent}>
              {/* Hàng 1: Brand & Status badge */}
              <View style={styles.moderationRow}>
                <ShimmerBlock width={54} height={12} borderRadius={4} />
                <ShimmerBlock width={68} height={18} borderRadius={9} />
              </View>

              {/* Hàng 2: Tên thiết bị (1 dòng) */}
              <ShimmerBlock width="80%" height={14} borderRadius={4} />

              {/* Hàng 3: Giá thuê & Tên chủ */}
              <View style={styles.moderationRow}>
                <ShimmerBlock width={88} height={13} borderRadius={4} />
                <ShimmerBlock width={72} height={13} borderRadius={4} />
              </View>
            </View>
          </View>

          {/* Hàng 2 nút Action (Từ chối & Duyệt) */}
          <View style={styles.moderationActionRow}>
            <ShimmerBlock width="48%" height={32} borderRadius={8} />
            <ShimmerBlock width="48%" height={32} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: theme.colors.border.light,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
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
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
  },
  bubbleRight: {
    backgroundColor: theme.colors.brand[100],
    padding: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  moderationCard: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border.divider,
  },
  moderationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moderationThumb: {
    marginRight: 12,
  },
  moderationContent: {
    flex: 1,
    height: 64,
    justifyContent: 'space-between',
  },
  moderationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moderationActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.divider,
  },
});
