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

export type UserRole = 'renter' | 'owner' | 'admin';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [kinh độ (lng), vĩ độ (lat)]
}

export interface UserAddress {
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  fullAddress: string;
}

export interface User {
  _id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
  address?: UserAddress;
  location?: GeoPoint;
  favoriteDevices?: string[];
  rating?: number;
  ownerRating?: number;
  totalReviews?: number;
  totalReview?: number;
  trustScore?: number;
  walletBalance?: number;
  walletEscrowBalance?: number;
  badges?: string[];
  referralCode?: string;
  referredBy?: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceCategory =
  | 'smartphone'
  | 'laptop'
  | 'camera'
  | 'drone'
  | 'audio'
  | 'tablet'
  | 'accessory';

export interface DeviceAiAnalysis {
  summary: string;
  pros: string[];
  cons: string[];
  rentalRecommendation: string;
  analyzedAt?: string;
}

export interface DeviceLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  address: string;
}

export interface Device {
  name?: string;
  distanceMeters?: number;
  _id: string;
  addressText?: string;
  owner: User | string;
  title: string;
  brand: string;
  category: DeviceCategory;
  dailyRate: number;
  depositValue: number;
  images: string[];
  specs: Record<string, string>;
  description: string;
  location: DeviceLocation;
  status: DeviceStatus;
  rating: number;
  reviewCount: number;
  aiAnalysis?: DeviceAiAnalysis;
  viewsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceStatus = 'available' | 'rented' | 'maintenance' | 'hidden';

export type ScreenType =
  | 'home'
  | 'bookings'
  | 'map'
  | 'compare'
  | 'postDevice'
  | 'owner'
  | 'admin'
  | 'login'
  | 'register'
  | 'profile'
  | 'notification';
