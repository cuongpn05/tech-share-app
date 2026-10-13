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
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  otherUserAvatar,
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
      {/* Avatar người gửi đối diện */}
      {!isFromMe && (
        <Image
          source={{
            uri:
              otherUserAvatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
          }}
          style={styles.avatar}
        />
      )}

      <View
        style={[
          styles.bubble,
          isFromMe ? styles.bubbleFromMe : styles.bubbleFromOther,
        ]}
      >
        {/* 1. Tin nhắn Template / Mẫu nhanh */}
        {message.messageType === 'template' && (
          <View style={styles.templateBadge}>
            <Ionicons name="flash" size={12} color="#0D9488" style={{ marginRight: 4 }} />
            <Text style={styles.templateBadgeText}>Mẫu tin nhắn nhanh</Text>
          </View>
        )}

        {/* 2. Tin nhắn Hình ảnh */}
        {message.messageType === 'image' && message.mediaUrl ? (
          <Image
            source={{ uri: message.mediaUrl }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        ) : null}

        {/* 3. Tin nhắn Vị trí GPS */}
        {message.messageType === 'location' && message.locationData ? (
          <TouchableOpacity
            style={styles.locationContainer}
            onPress={handleOpenLocation}
            activeOpacity={0.8}
          >
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={18} color="#EF4444" />
              <Text style={styles.locationTitle}>Vị trí được chia sẻ</Text>
            </View>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {message.locationData.address ||
                `${message.locationData.latitude.toFixed(5)}, ${message.locationData.longitude.toFixed(5)}`}
            </Text>
            <View style={styles.locationAction}>
              <Text style={styles.locationActionText}>Chạm để mở trên Google Maps</Text>
              <Ionicons name="open-outline" size={14} color="#0D9488" />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 4. Nội dung Text */}
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

        {/* Thời gian & Trạng thái gửi */}
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
                <Ionicons name="time-outline" size={12} color="#99F6E4" />
              ) : message.status === 'read' ? (
                <Ionicons name="checkmark-done" size={13} color="#99F6E4" />
              ) : (
                <Ionicons name="checkmark" size={13} color="#99F6E4" />
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
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#E2E8F0',
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.76,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleFromMe: {
    backgroundColor: '#0D9488', // Brand Teal
    borderBottomRightRadius: 4,
  },
  bubbleFromOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.card,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  textFromMe: {
    color: '#FFFFFF',
  },
  textFromOther: {
    color: '#0F172A',
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
    color: '#CCFBF1',
  },
  timeFromOther: {
    color: '#94A3B8',
  },
  statusBox: {
    marginLeft: 2,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  templateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  locationContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
  },
  locationAddress: {
    fontSize: 12.5,
    color: '#475569',
    marginBottom: 6,
  },
  locationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  locationActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0D9488',
  },
});

export default MessageBubble;
