import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';

export interface ConversationListItemData {
  id: string;
  bookingId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    isVerified?: boolean;
  };
  lastMessage: string;
  timeFormatted: string;
  unreadCount: number;
  isFromMe?: boolean;
}

export interface ConversationListItemProps {
  item: ConversationListItemData;
  onPress: () => void;
  showDivider?: boolean;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  item,
  onPress,
  showDivider = true,
}) => {
  const hasUnread = item.unreadCount > 0;
  const displayText = item.isFromMe
    ? `You: ${item.lastMessage}`
    : item.lastMessage;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${item.user.name}`}
      >
        {/* Counterpart User Avatar */}
        <View style={styles.avatarContainer}>
          {item.user.avatar ? (
            <Image
              source={{ uri: item.user.avatar }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name="person"
                size={22}
                color={theme.colors.brand[500]}
              />
            </View>
          )}

          {/* eKYC / Trust Verified Badge */}
          {Boolean(item.user.isVerified) && (
            <View style={styles.verifiedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.colors.brand[500]}
              />
            </View>
          )}
        </View>

        {/* Message Thread Details */}
        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text
              style={[styles.userName, hasUnread && styles.userNameUnread]}
              numberOfLines={1}
            >
              {item.user.name}
            </Text>
            <Text
              style={[styles.timestamp, hasUnread && styles.timestampUnread]}
            >
              {item.timeFormatted}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.lastMessage,
                hasUnread && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {displayText}
            </Text>

            {/* Unread Counter Badge */}
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Subtle Inset Divider */}
      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.surface,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.brand[50],
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.surface,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginRight: 8,
  },
  userNameUnread: {
    fontWeight: theme.typography.fontWeight.bold,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.text.subtle,
    fontWeight: theme.typography.fontWeight.normal,
  },
  timestampUnread: {
    color: theme.colors.brand[500],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 13.5,
    color: theme.colors.text.muted,
    lineHeight: 18,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  unreadBadge: {
    backgroundColor: theme.colors.brand[500],
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    lineHeight: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.surfaceMuted,
    marginLeft: 82, // 16 margin + 52 avatar + 14 spacing
  },
});

export default ConversationListItem;
