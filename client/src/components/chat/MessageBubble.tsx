import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { ChatMessage } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  showAvatar?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  otherUserAvatar,
  showAvatar = true,
}) => {
  const isFromMe = String(message.senderId) === String(currentUserId);

  // Định dạng giờ hiển thị
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleOpenLocation = () => {
    if (message.locationData?.latitude && message.locationData?.longitude) {
      const { latitude, longitude } = message.locationData;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View
      style={[
        styles.rowContainer,
        isFromMe ? styles.rowFromMe : styles.rowFromOther,
      ]}
    >
      {/* 2. Không bao giờ hiện avatar của chính mình; 3. Quy tắc gom cụm (Cluster Rule) - chỉ hiện ở tin cuối cụm */}
      {!isFromMe && (
        showAvatar ? (
          otherUserAvatar ? (
            <Image
              source={{ uri: otherUserAvatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color={theme.colors.text.muted} />
            </View>
          )
        ) : (
          <View style={styles.avatarSpacer} />
        )
      )}

      <View
        style={[
          styles.bubble,
          isFromMe ? styles.bubbleFromMe : styles.bubbleFromOther,
        ]}
      >


        {/* 2. Image Message */}
        {message.messageType === 'image' && message.mediaUrl ? (
          <Image
            source={{ uri: message.mediaUrl }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        ) : null}

        {/* 3. Location Message */}
        {message.messageType === 'location' && message.locationData ? (
          <TouchableOpacity
            style={styles.locationContainer}
            onPress={handleOpenLocation}
            activeOpacity={0.8}
          >
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={18} color={theme.colors.error} />
              <Text style={styles.locationTitle}>Shared Location</Text>
            </View>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {message.locationData.address ||
                `${message.locationData.latitude.toFixed(5)}, ${message.locationData.longitude.toFixed(5)}`}
            </Text>
            <View style={styles.locationAction}>
              <Text style={styles.locationActionText}>Tap to open on Google Maps</Text>
              <Ionicons name="open-outline" size={14} color={theme.colors.brand[500]} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 4. Text Content */}
        {message.text ? (
          <Text
            style={[
              styles.messageText,
              isFromMe ? styles.textFromMe : styles.textFromOther,
            ]}
          >
            {message.text}
          </Text>
        ) : null}

        {/* Timestamp & Status */}
        <View style={styles.metaRow}>
          <Text
            style={[
              styles.timeText,
              isFromMe ? styles.timeFromMe : styles.timeFromOther,
            ]}
          >
            {formatTime(message.createdAt)}
          </Text>

          {isFromMe && (
            <View style={styles.statusBox}>
              {message.isSending ? (
                <Ionicons name="time-outline" size={12} color={theme.colors.brand[100]} />
              ) : message.status === 'read' ? (
                <Ionicons name="checkmark-done" size={13} color={theme.colors.brand[100]} />
              ) : (
                <Ionicons name="checkmark" size={13} color={theme.colors.brand[100]} />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  rowFromMe: {
    justifyContent: 'flex-end',
  },
  rowFromOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: theme.colors.border.default,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpacer: {
    width: 28,
    marginRight: 8,
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.76,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleFromMe: {
    backgroundColor: theme.colors.brand[500],
    borderBottomRightRadius: 4,
  },
  bubbleFromOther: {
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  textFromMe: {
    color: theme.colors.white,
  },
  textFromOther: {
    color: theme.colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  timeFromMe: {
    color: theme.colors.brand[100],
  },
  timeFromOther: {
    color: theme.colors.text.subtle,
  },
  statusBox: {
    marginLeft: 2,
  },

  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  locationContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginLeft: 4,
  },
  locationAddress: {
    fontSize: 12.5,
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  locationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
    paddingTop: 6,
  },
  locationActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.brand[500],
  },
});

export default MessageBubble;
