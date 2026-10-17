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
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { OWNER_STRINGS } from '../../constants/ownerStrings';
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
  const initialBookingId = propBookingId || route?.params?.bookingId || '';
  const [effectiveBookingId, setEffectiveBookingId] = useState(initialBookingId);
  const otherBookings = route?.params?.otherBookings || [];
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    const nextId = propBookingId || route?.params?.bookingId;
    if (nextId && nextId !== effectiveBookingId) {
      setEffectiveBookingId(nextId);
    }
  }, [propBookingId, route?.params?.bookingId]);

  // Lấy ID tài khoản người dùng hiện tại từ Redux Store
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id || '';

  const [booking, setBooking] = useState<ChatBookingInfo | null>(null);
  const [otherUser, setOtherUser] = useState<ChatOtherUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 1. Tải lịch sử chat từ API MongoDB (GET /api/chats/:bookingId)
  const loadChatHistory = useCallback(async () => {
    if (!effectiveBookingId) return;
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await chatService.getChatHistory(effectiveBookingId);
      if (data) {
        setBooking(data.booking);
        setOtherUser(data.otherUser);
        setMessages(data.messages || []);

        // Kiểm tra chặn nếu đối tác là chính mình
        const otherId = String(data.otherUser?._id || '');
        const myId = String(currentUserId || '');
        const checkIsSelf =
          (otherId && myId && otherId === myId) ||
          Boolean(
            data.otherUser?.name &&
              currentUser?.name &&
              data.otherUser.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
          );

        if (checkIsSelf) {
          setLoadError(OWNER_STRINGS.MESSAGES.CANNOT_CHAT_WITH_SELF);
        }
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.message;
      console.warn('[ChatDetail] Load history error:', serverMsg);

      if (serverMsg?.includes('chính mình') || err?.response?.status === 400) {
        setLoadError(serverMsg || OWNER_STRINGS.MESSAGES.CANNOT_CHAT_WITH_SELF);
      } else {
        setLoadError(serverMsg || 'Không thể tải lịch sử trò chuyện.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBookingId, currentUserId, currentUser?.name]);

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

      // Lắng nghe tin nhắn mới từ đối phương & socket
      const unsubscribeNewMsg = socketService.onNewMessage((incomingMsg: ChatMessage) => {
        if (incomingMsg.bookingId !== effectiveBookingId) return;

        // Đánh dấu đã đọc ngay lập tức vì đang ở TRỰC TIẾP trong màn hình chat
        chatService.markChatAsRead(effectiveBookingId);

        setMessages((prev) => {
          // 1. Tránh lặp nếu tin nhắn này đã có mặt trong danh sách theo _id chính thức
          if (prev.some((m) => m._id === incomingMsg._id)) return prev;

          const isFromMe =
            Boolean(currentUserId) &&
            String(incomingMsg.senderId).trim() === String(currentUserId).trim();

          if (isFromMe) {
            // Tin nhắn do chính mình gửi:
            // Tìm tin nhắn tạm đang gửi (isSending hoặc bắt đầu bằng temp-)
            const tempIndex = prev.findIndex(
              (m) =>
                m._id.startsWith('temp-') ||
                m.isSending ||
                (m.text === incomingMsg.text && m.messageType === incomingMsg.messageType)
            );

            if (tempIndex !== -1) {
              // Hoán đổi tin nhắn tạm thành tin nhắn chính thức từ DB
              const next = [...prev];
              next[tempIndex] = incomingMsg;
              return next;
            }

            // Nếu không còn tin nhắn tạm, kiểm tra xem đã có tin nhắn cùng nội dung vừa gửi trong vòng 10 giây (tránh race condition giữa HTTP và Socket)
            const hasDuplicateContent = prev.some(
              (m) =>
                String(m.senderId).trim() === String(currentUserId).trim() &&
                m.text === incomingMsg.text &&
                m.messageType === incomingMsg.messageType &&
                Math.abs(new Date(m.createdAt).getTime() - new Date(incomingMsg.createdAt).getTime()) < 10000
            );

            if (hasDuplicateContent) {
              return prev;
            }

            return [incomingMsg, ...prev];
          }

          // Tin nhắn từ đối phương
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

  // Kiểm tra xem đối tác có phải là chính mình không
  const isSelf = Boolean(
    (otherUser?._id && String(otherUser._id) === String(currentUserId)) ||
    (otherUser?.name &&
      currentUser?.name &&
      otherUser.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
  );

  // 3. Cơ chế gửi tin với Optimistic UI
  const dispatchMessage = async (
    messageType: ChatMessageType,
    text?: string,
    mediaUrl?: string,
    locationData?: LocationData
  ) => {
    if (!effectiveBookingId) return;
    if (isSelf) {
      Alert.alert('Thông báo', OWNER_STRINGS.MESSAGES.CANNOT_CHAT_WITH_SELF);
      return;
    }

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
      setMessages((prev) => {
        // 1. Nếu tin nhắn tạm tempId vẫn còn (socket chưa hoán đổi), thay thế nó bằng savedMessage
        if (prev.some((m) => m._id === tempId)) {
          return prev.map((m) => (m._id === tempId ? savedMessage : m));
        }

        // 2. Nếu socket đã hoán đổi trước đó và _id đã tồn tại, không thêm lại
        if (prev.some((m) => m._id === savedMessage._id)) {
          return prev;
        }

        // 3. Nếu còn bất kỳ tin nhắn tạm nào có cùng nội dung
        const lingeringIndex = prev.findIndex(
          (m) => (m._id.startsWith('temp-') || m.isSending) && m.text === savedMessage.text
        );
        if (lingeringIndex !== -1) {
          const next = [...prev];
          next[lingeringIndex] = savedMessage;
          return next;
        }

        return [savedMessage, ...prev];
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      Alert.alert('Lỗi', err.message || 'Gửi tin nhắn thất bại. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

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
      <View style={[styles.header, { paddingTop: topInset }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.avatarWrapper}>
          {otherUser?.avatar ? (
            <Image
              source={{ uri: otherUser.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
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

      {/* Hiển thị lỗi nếu đơn thuê bị chặn (ví dụ tự chat với chính mình) */}
      {loadError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#E11D48" />
          <Text style={styles.errorTitle}>Không thể mở cuộc trò chuyện</Text>
          <Text style={styles.errorSubtitle}>{loadError}</Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.goBackButtonText}>Quay lại danh sách</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Banner thông tin thiết bị đang thuê */}
          {booking?.device && (
            <View style={styles.deviceBanner}>
              {booking.device.image ? (
                <Image
                  source={{ uri: booking.device.image }}
                  style={styles.bannerImage}
                />
              ) : (
                <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#64748B" />
                </View>
              )}
              <View style={styles.bannerDetails}>
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {booking.device.title}
                </Text>
                <Text style={styles.bannerSubtitle}>
                  Mã đơn: {booking.bookingCode || effectiveBookingId.slice(-6).toUpperCase()} •{' '}
                  <Text style={styles.bannerStatus}>{booking.status.toUpperCase()}</Text>
                </Text>
              </View>

              {Boolean(otherBookings && otherBookings.length > 1) && (
                <TouchableOpacity
                  style={styles.switchBookingBtn}
                  onPress={() => setShowBookingModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={15} color={theme.colors.brand[600]} />
                  <Text style={styles.switchBookingBtnText}>
                    {`${OWNER_STRINGS.MESSAGES.SWITCH_BOOKING} (${otherBookings.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Danh sách tin nhắn - Khi chưa có tin nhắn, render Empty State bên ngoài FlatList để không bị lật ngược chữ */}
          {isLoading && messages.length === 0 ? (
            <ChatMessagesSkeleton />
          ) : messages.length === 0 ? (
            <View style={styles.emptyMessagesContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyMessagesTitle}>
                {OWNER_STRINGS.MESSAGES.START_CONVERSATION_TITLE}
              </Text>
              <Text style={styles.emptyMessagesSubtitle}>
                {`${OWNER_STRINGS.MESSAGES.START_CONVERSATION_SUBTITLE} ${otherUser?.name || OWNER_STRINGS.MESSAGES.PARTNER}.`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              inverted={true}
              keyExtractor={(item) => item._id}
              renderItem={({ item, index }) => {
                const isSent = String(item.senderId) === String(currentUserId);
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
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Chặn thanh nhập tin nhắn nếu là tự chat với chính mình */}
          {isSelf ? (
            <View style={styles.selfChatBanner}>
              <Ionicons name="information-circle-outline" size={20} color="#E11D48" />
              <Text style={styles.selfChatBannerText}>
                {OWNER_STRINGS.MESSAGES.CANNOT_CHAT_WITH_SELF}
              </Text>
            </View>
          ) : (
            <>
              {/* Thanh mẫu tin nhắn nhanh */}
              <QuickMessageBar
                onSelectTemplate={(tpl) => dispatchMessage('template', tpl)}
                disabled={isSending}
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
            </>
          )}
        </>
      )}

      {/* Modal chuyển đổi ngữ cảnh đơn thuê giữa cùng 1 người dùng */}
      <Modal
        visible={showBookingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBookingModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {OWNER_STRINGS.MESSAGES.SWITCH_BOOKING_TITLE}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBookingModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={theme.colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {otherBookings.map((b: any) => {
                const isSelected = b.bookingId === effectiveBookingId;
                return (
                  <TouchableOpacity
                    key={b.bookingId}
                    style={[
                      styles.bookingOptionItem,
                      isSelected && styles.bookingOptionSelected,
                    ]}
                    onPress={() => {
                      if (b.bookingId !== effectiveBookingId) {
                        setEffectiveBookingId(b.bookingId);
                      }
                      setShowBookingModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bookingOptionLeft}>
                      <Ionicons
                        name="hardware-chip-outline"
                        size={18}
                        color={isSelected ? theme.colors.brand[500] : theme.colors.text.muted}
                      />
                      <View style={styles.bookingOptionInfo}>
                        <Text
                          style={[
                            styles.bookingOptionName,
                            isSelected && styles.bookingOptionNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {b.deviceName || 'Thiết bị'}
                        </Text>
                        <Text style={styles.bookingOptionCode}>
                          Mã: {b.bookingId.slice(-6).toUpperCase()} • {b.statusLabel || b.status}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.brand[500]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  avatarWrapper: {
    position: 'relative',
    width: 38,
    height: 38,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 17,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.muted,
    marginTop: 2,
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
  bannerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
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
  switchBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 4,
    marginLeft: 8,
  },
  switchBookingBtnText: {
    fontSize: 12,
    color: theme.colors.brand[600],
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalList: {
    marginTop: 10,
  },
  bookingOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bookingOptionSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: theme.colors.brand[500],
  },
  bookingOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  bookingOptionInfo: {
    flex: 1,
  },
  bookingOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  bookingOptionNameSelected: {
    color: theme.colors.brand[600],
    fontWeight: '700',
  },
  bookingOptionCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyMessagesContainer: {
    flex: 1,
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
  selfChatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderTopWidth: 1,
    borderTopColor: '#FECDD3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  selfChatBannerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#E11D48',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
    gap: 6,
  },
  goBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ChatDetailScreen;
