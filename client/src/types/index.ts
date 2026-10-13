/**
 * TypeScript Interfaces & Types cho Hệ thống TechShare & Chat in-app
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export type ChatMessageType = 'text' | 'image' | 'location' | 'template';

export interface ChatMessage {
  _id: string;
  bookingId: string;
  senderId: string;
  receiverId?: string;
  messageType: ChatMessageType;
  text?: string;
  mediaUrl?: string;
  locationData?: LocationData;
  createdAt: string;
  isSending?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface ChatBookingInfo {
  _id: string;
  bookingCode?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  device?: {
    _id: string;
    title: string;
    image?: string;
    brand?: string;
  } | null;
}

export interface ChatOtherUser {
  _id: string;
  name: string;
  avatar?: string;
  role?: string;
  phone?: string;
}

export interface ChatHistoryResponse {
  booking: ChatBookingInfo;
  otherUser: ChatOtherUser;
  messages: ChatMessage[];
}

export interface ChatConversationItem {
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  otherUser: {
    _id: string;
    name: string;
    avatar?: string;
    phone?: string;
    isVerified?: boolean;
    role?: string;
  } | null;
  device: {
    _id: string;
    title: string;
    image?: string;
    brand?: string;
  } | null;
  lastMessage: {
    _id: string;
    text: string;
    senderId: string;
    isFromMe: boolean;
    createdAt: string;
    status: string;
  } | null;
  unreadCount: number;
  lastActivityAt: string;
}
