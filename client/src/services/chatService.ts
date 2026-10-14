import { apiClient } from '../config/api';
import {
  ChatHistoryResponse,
  ChatMessage,
  ChatMessageType,
  LocationData,
  ChatConversationItem,
} from '../types';

export interface SendMessagePayload {
  text?: string;
  messageType: ChatMessageType;
  mediaUrl?: string;
  locationData?: LocationData;
}

export const chatService = {
  getConversations: async (role?: string): Promise<ChatConversationItem[]> => {
    const response = await apiClient.get('/chats/conversations', {
      params: role ? { role } : {},
    });
    return response.data?.data || [];
  },

  getChatHistory: async (bookingId: string): Promise<ChatHistoryResponse> => {
    const response = await apiClient.get(`/chats/${bookingId}`);
    return response.data?.data;
  },

  sendMessage: async (
    bookingId: string,
    payload: SendMessagePayload
  ): Promise<ChatMessage> => {
    const response = await apiClient.post(`/chats/${bookingId}/messages`, payload);
    return response.data?.data;
  },

  markChatAsRead: async (bookingId: string): Promise<void> => {
    try {
      await apiClient.patch(`/chats/${bookingId}/read`);
    } catch (err: any) {
      console.warn('Failed to mark chat as read:', err?.message);
    }
  },

  uploadChatImage: async (imageUri: string): Promise<string> => {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: `chat-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    const response = await apiClient.post('/chats/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data?.url;
  },
};

export default chatService;
