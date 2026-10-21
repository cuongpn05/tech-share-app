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
  senderName?: string;
  senderAvatar?: string;
  deviceTitle?: string;
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

export interface UserTrust {
  isVerified?: boolean;
  score?: number;
  badges?: string[];
}

export interface UserWallet {
  balance?: number;
  escrowBalance?: number;
}

export interface UserPushConfig {
  expoPushToken?: string;
  fcmTokens?: string[];
  biometricEnabled?: boolean;
}

export interface User {
  _id: string;
  accountId?: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
  address?: UserAddress | string;
  location?: GeoPoint;
  trust?: UserTrust;
  badges?: string[];
  wallet?: UserWallet;
  pushConfig?: UserPushConfig;
  biometricEnabled?: boolean;
  wishlist?: string[];
  referralCode?: string;
  referredBy?: string | null;
  favoriteDevices?: string[];
  rating?: number;
  ownerRating?: number;
  totalReviews?: number;
  totalReview?: number;
  trustScore?: number;
  walletBalance?: number;
  walletEscrowBalance?: number;
  isVerified?: boolean;
  isActive?: boolean;
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
  | 'gaming'
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
  addressText?: string;
}

export interface Device {
  ownerId?: User | string | null;
  name?: string;
  pricePerDay?: number;
  stats?: { ratingAvg?: number; ratingCount?: number };
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

export type ManagedDeviceStatus = Exclude<DeviceStatus, 'rented'>;

export interface BlockedDate {
  startDate: string;
  endDate: string;
  reason?: string;
}

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

export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type ModerationFilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export interface DeviceModerationOwner {
  _id: string;
  name: string;
  avatar?: string;
  phone?: string;
  trustScore: number;
  isVerified: boolean;
}

export interface DeviceModerationItem {
  _id: string;
  id: string;
  name: string;
  brand: string;
  category: DeviceCategory | string;
  pricePerDay: number;
  depositAmount: number;
  images: string[];
  thumbnail: string;
  moderationStatus: ModerationStatus;
  rejectReason?: string;
  createdAt: string;
  addressText: string;
  owner: DeviceModerationOwner;
}

export interface ModerationTabCounts {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalAll: number;
}

export interface GetModerationParams {
  status?: ModerationFilterStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DeviceModerationDetailItem extends DeviceModerationItem {
  yearOfManufacture?: number;
  condition?: string;
  description?: string;
  specs?: Record<string, string>;
  accessories?: string[];
  location?: {
    type?: string;
    coordinates?: [number, number];
    addressText?: string;
  };
  owner: DeviceModerationOwner & {
    email?: string;
    rating?: number;
    address?: string;
  };
}
