export type UserRole = "renter" | "owner" | "admin";

export interface GeoPoint {
  type: "Point";
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
  | "smartphone"
  | "laptop"
  | "camera"
  | "drone"
  | "audio"
  | "tablet"
  | "accessory";

export interface DeviceAiAnalysis {
  summary: string;
  pros: string[];
  cons: string[];
  rentalRecommendation: string;
  analyzedAt?: string;
}

export interface DeviceLocation {
  type: "Point";
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
export type DeviceStatus = "available" | "rented" | "maintenance" | "hidden";


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



