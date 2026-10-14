import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { chatService } from '../../services/chatService';
import { socketService } from '../../services/socketService';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { QuickMessageBar } from '../../components/chat/QuickMessageBar';
import { ChatInputBar } from '../../components/chat/ChatInputBar';
import { useAppSelector } from '../../store';
import { ChatMessagesSkeleton } from '../../components/common/ShimmerPlaceholders';
import {
  ChatMessage,
  ChatBookingInfo,
  ChatOtherUser,
  LocationData,
  ChatMessageType,
} from '../../types';

export interface ChatDetailScreenProps {
  route?: any;
  navigation?: any;
  bookingId?: string;
  onBack?: () => void;
}

export const ChatDetailScreen: React.FC<ChatDetailScreenProps> = ({
  route,
  navigation,
  bookingId: propBookingId,
  onBack,
}) => {
  const effectiveBookingId = propBookingId || route?.params?.bookingId || '';

  // Lấy ID tài khoản người dùng hiện tại từ Redux Store
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id || '';

  const [booking, setBooking] = useState<ChatBookingInfo | null>(null);
  const [otherUser, setOtherUser] = useState<ChatOtherUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Tải lịch sử chat từ API MongoDB (GET /api/chats/:bookingId)
  const loadChatHistory = useCallback(async () => {
    if (!effectiveBookingId) return;
    try {
      setIsLoading(true);
      const data = await chatService.getChatHistory(effectiveBookingId);
      if (data) {
        setBooking(data.booking);
        setOtherUser(data.otherUser);
        setMessages(data.messages || []);
      }
    } catch (err: any) {
      console.warn('[ChatDetail] Load history error:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBookingId]);

  // 2. Kết nối Socket & Lắng nghe tin nhắn mới + Read Receipts CHỈ KHI màn hình đang được FOCUS
  useFocusEffect(
    useCallback(() => {
      if (!effectiveBookingId) return;

      loadChatHistory();
      chatService.markChatAsRead(effectiveBookingId);

      // Kết nối socket cá nhân nếu chưa kết nối
      if (currentUserId) {
        socketService.connect(currentUserId);
      }

      // Gia nhập room chat của đơn thuê & đánh dấu đang xem phòng này
      socketService.joinChat(effectiveBookingId);

      // Lắng nghe tin nhắn mới từ đối phương
      const unsubscribeNewMsg = socketService.onNewMessage((incomingMsg: ChatMessage) => {
        if (incomingMsg.bookingId !== effectiveBookingId) return;

        // Đánh dấu đã đọc ngay lập tức vì đang ở TRỰC TIẾP trong màn hình chat
        chatService.markChatAsRead(effectiveBookingId);

        setMessages((prev) => {
          if (prev.some((m) => m._id === incomingMsg._id)) return prev;
          // Tránh trùng nếu tin nhắn là do chính mình gửi và đã được cập nhật bởi optimistic UI
          if (incomingMsg.senderId === currentUserId) {
            const hasTemp = prev.some((m) => m.isSending && m.text === incomingMsg.text);
            if (hasTemp) return prev;
          }
          return [incomingMsg, ...prev];
        });
      });

      // Lắng nghe sự kiện đối phương đã đọc tin nhắn để cập nhật trạng thái 'read'
      const unsubscribeReadReceipt = socketService.onMessagesRead(
        (data: { bookingId: string; readBy: string }) => {
          if (data.bookingId === effectiveBookingId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderId === currentUserId && m.status !== 'read'
                  ? { ...m, status: 'read' }
                  : m
              )
            );
          }
        }
      );

      // Khi BLUR (rời khỏi màn hình hoặc đóng màn hình): lập tức dọn dẹp và rời room
      return () => {
        unsubscribeNewMsg();
        unsubscribeReadReceipt();
        socketService.leaveChat(effectiveBookingId);
      };
    }, [effectiveBookingId, loadChatHistory, currentUserId])
  );

  // 3. Cơ chế gửi tin với Optimistic UI
  const dispatchMessage = async (
    messageType: ChatMessageType,
    text?: string,
    mediaUrl?: string,
    locationData?: LocationData
  ) => {
    if (!effectiveBookingId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      bookingId: effectiveBookingId,
      senderId: currentUserId,
      messageType,
      text,
      mediaUrl,
      locationData,
      createdAt: new Date().toISOString(),
      isSending: true,
      status: 'sending',
    };

    // Đẩy ngay vào đầu danh sách (do FlatList inverted)
    setMessages((prev) => [optimisticMessage, ...prev]);
    setIsSending(true);

    try {
      const savedMessage = await chatService.sendMessage(effectiveBookingId, {
        text,
        messageType,
        mediaUrl,
        locationData,
      });

      // Hoán đổi tin nhắn tạm thành tin nhắn chính thức từ DB
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? savedMessage : m))
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      Alert.alert('Lỗi', err.message || 'Gửi tin nhắn thất bại. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  const statusBarOffset = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (navigation?.navigate) {
      navigation.navigate('OwnerMessages');
      return;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.surface}
        translucent={true}
      />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: statusBarOffset + 10 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.avatarWrapper}>
          <Image
            source={{
              uri:
                otherUser?.avatar ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
            }}
            style={styles.avatar}
          />
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {otherUser?.name || 'Khách thuê'}
          </Text>
          <Text style={styles.userRole}>
            {(otherUser?.role || 'Renter').toUpperCase()}
          </Text>
        </View>

        {otherUser?.phone ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${otherUser.phone}`)}
            style={styles.callButton}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={20} color="#0D9488" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Banner thông tin thiết bị đang thuê */}
      {booking?.device && (
        <View style={styles.deviceBanner}>
          <Image
            source={{
              uri:
                booking.device.image ||
                'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
            }}
            style={styles.bannerImage}
          />
          <View style={styles.bannerDetails}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {booking.device.title}
            </Text>
            <Text style={styles.bannerSubtitle}>
              Mã đơn: {booking.bookingCode || effectiveBookingId.slice(-6).toUpperCase()} •{' '}
              <Text style={styles.bannerStatus}>{booking.status.toUpperCase()}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Danh sách tin nhắn đảo ngược (FlatList Inverted) */}
      {isLoading && messages.length === 0 ? (
        <ChatMessagesSkeleton />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => {
            const isSent = String(item.senderId) === String(currentUserId);
            // Quy tắc gom cụm (Cluster Rule) trong FlatList inverted (messages[0] là tin mới nhất ở dưới cùng):
            // Chỉ hiện avatar tròn 28x28 ở tin nhắn dưới cùng của một cụm tin đối phương:
            // index === 0 HOẶC tin liền kề phía dưới (index - 1) là tin do chính mình gửi
            const isLastInReceivedCluster =
              !isSent &&
              (index === 0 ||
                String(messages[index - 1]?.senderId) === String(currentUserId));

            return (
              <MessageBubble
                message={item}
                currentUserId={currentUserId}
                otherUserId={otherUser?._id}
                otherUserAvatar={otherUser?.avatar}
                showAvatar={isLastInReceivedCluster}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessagesContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyMessagesTitle}>Bắt đầu cuộc trò chuyện</Text>
              <Text style={styles.emptyMessagesSubtitle}>
                Gửi tin nhắn hoặc chọn mẫu tin nhắn nhanh bên dưới để trao đổi với {otherUser?.name || 'đối tác'}.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Thanh mẫu tin nhắn nhanh */}
      <QuickMessageBar
        onSelectTemplate={(tpl) => dispatchMessage('template', tpl)}
      />

      {/* Thanh nhập tin nhắn đa phương tiện & đính kèm */}
      <ChatInputBar
        onSendText={(text) => dispatchMessage('text', text)}
        onSendImage={async (uri) => {
          try {
            setIsSending(true);
            const uploadedUrl = await chatService.uploadChatImage(uri);
            if (uploadedUrl) {
              await dispatchMessage('image', undefined, uploadedUrl);
            }
          } catch (err: any) {
            Alert.alert('Lỗi', 'Không thể tải ảnh lên: ' + (err.message || 'Lỗi mạng'));
          } finally {
            setIsSending(false);
          }
        }}
        onSendLocation={(loc) => dispatchMessage('location', undefined, undefined, loc)}
        isSending={isSending}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  avatarWrapper: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bannerImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  bannerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bannerStatus: {
    color: '#0D9488',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyMessagesContainer: {
    transform: [{ scaleY: -1 }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyMessagesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyMessagesSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ChatDetailScreen;
