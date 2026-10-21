import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import {
  consultRentalAssistant,
  type AIConsultRecommendation,
} from '../../services/aiService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recommendations?: AIConsultRecommendation[];
}

interface AiChatConsultantProps {
  onBack: () => void;
  onNavigateToDeviceDetail: (deviceId: string) => void;
}

export function AiChatConsultant({
  onBack,
  onNavigateToDeviceDetail,
}: AiChatConsultantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: STRINGS.AI_CHAT.WELCOME_MESSAGE,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const nextMessageId = useRef(0);

  const addMessage = (
    sender: ChatMessage['sender'],
    text: string,
    recommendations?: AIConsultRecommendation[],
  ) => {
    nextMessageId.current += 1;
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `message-${nextMessageId.current}`,
        sender,
        text,
        recommendations,
      },
    ]);
  };

  const sendMessage = async (messageText: string) => {
    const message = messageText.trim();
    if (!message || isLoading) return;

    addMessage('user', message);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await consultRentalAssistant(message);
      addMessage(
        'assistant',
        response.reply || response.message || STRINGS.AI_CHAT.NO_MATCH,
        response.recommendations,
      );
    } catch (error: unknown) {
      console.error('[AiChatConsultant] Cannot get recommendations:', error);
      addMessage('assistant', STRINGS.AI_CHAT.ERR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRecommendation = (item: AIConsultRecommendation) => {
    const imageUrl = item.device.images?.[0];

    return (
      <View key={item.device._id} style={styles.recommendationCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.deviceImage} />
        ) : (
          <View style={[styles.deviceImage, styles.imagePlaceholder]}>
            <Ionicons
              name="hardware-chip-outline"
              size={28}
              color={colors.light.textMuted}
            />
          </View>
        )}
        <View style={styles.recommendationDetails}>
          <Text style={styles.deviceName}>{item.device.name}</Text>
          <Text style={styles.devicePrice}>
            {item.device.pricePerDay.toLocaleString('vi-VN')}
            {STRINGS.DEVICE_CARD.PRICE_SUFFIX}
          </Text>
          <Text style={styles.recommendationReason}>{item.reason}</Text>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => onNavigateToDeviceDetail(item.device._id)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsButtonText}>
              {STRINGS.AI_CHAT.VIEW_DETAILS}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color={colors.light.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.light.background}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.AI_CHAT.ACCESSIBILITY_BACK}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={colors.light.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={19} color={colors.light.primary} />
          </View>
          <Text style={styles.headerTitle}>{STRINGS.AI_CHAT.HEADER_TITLE}</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.sender === 'user' && styles.userMessageRow,
              ]}
            >
              {message.sender === 'assistant' && (
                <View style={styles.messageAvatar}>
                  <Ionicons name="sparkles" size={15} color={colors.light.primary} />
                </View>
              )}
              <View
                style={[
                  styles.messageGroup,
                  message.sender === 'user' && styles.userMessageGroup,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    message.sender === 'user'
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.sender === 'user' && styles.userMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
                {message.recommendations?.map(renderRecommendation)}
              </View>
            </View>
          ))}

          {messages.length === 1 && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>
                {STRINGS.AI_CHAT.TRY_ASKING}
              </Text>
              {STRINGS.AI_CHAT.SUGGESTED_QUESTIONS.map((question) => (
                <TouchableOpacity
                  key={question}
                  style={styles.suggestionButton}
                  onPress={() => sendMessage(question)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={19}
                    color={colors.light.primaryDark}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingRow}>
              <View style={styles.messageAvatar}>
                <Ionicons name="sparkles" size={15} color={colors.light.ai} />
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={colors.light.ai} />
                <Text style={styles.loadingText}>
                  {STRINGS.AI_CHAT.THINKING}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={STRINGS.AI_CHAT.INPUT_PLACEHOLDER}
            placeholderTextColor={colors.light.textMuted}
            multiline
            maxLength={500}
            editable={!isLoading}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.AI_CHAT.ACCESSIBILITY_SEND}
          >
            <Ionicons name="send" size={18} color={colors.light.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderDefault,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.light.aiLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageGroup: {
    maxWidth: '84%',
  },
  userMessageGroup: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: colors.light.primary,
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: colors.light.surface,
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: colors.light.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: colors.light.white,
  },
  suggestions: {
    marginTop: 10,
    marginLeft: 38,
  },
  suggestionsTitle: {
    color: colors.light.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  suggestionText: {
    flex: 1,
    color: colors.light.textPrimary,
    fontSize: 13,
    marginRight: 8,
  },
  recommendationCard: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.light.surface,
  },
  deviceImage: {
    width: 78,
    height: 78,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationDetails: {
    flex: 1,
    marginLeft: 10,
  },
  deviceName: {
    color: colors.light.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  devicePrice: {
    color: colors.light.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  recommendationReason: {
    color: colors.light.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.light.primary,
  },
  detailsButtonText: {
    color: colors.light.white,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.light.surface,
  },
  loadingText: {
    color: colors.light.textSecondary,
    fontSize: 13,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderDefault,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 10,
    borderRadius: 21,
    backgroundColor: colors.light.background,
    color: colors.light.textPrimary,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 9,
    borderRadius: 21,
    backgroundColor: colors.light.primary,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
