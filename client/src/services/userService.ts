import apiClient from '../config/api';
import { Device, User } from '../types';
import { uploadImageWithCloudinary } from './cloudinaryUploadService';

export interface UpdateProfileParams {
  name?: string;
  phone?: string;
  address?: string;
  avatar?: string;
  biometricEnabled?: boolean;
}

export interface ProfileResponse {
  success: boolean;
  user: User;
  account?: {
    _id: string;
    username: string;
    email: string;
    role: string;
    lastLogin?: string;
  };
  message?: string;
}

export interface MapOwner {
  id: string;
  _id: string;
  name: string;
  avatar?: string;
  phone?: string;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  deviceCount: number;
  distanceMeters?: number | null;
  devices: Device[];
}

export const userService = {
  async getMapOwners(params?: { category?: string; lat?: number; lng?: number }): Promise<MapOwner[]> {
    const response = await apiClient.get<{ success: boolean; data: MapOwner[] }>('/owner/map-owners', {
      params: {
        category: params?.category && params.category !== 'all' ? params.category : undefined,
        lat: params?.lat,
        lng: params?.lng,
      },
    });
    if (response.data?.success !== true || !Array.isArray(response.data.data)) {
      throw new Error('Invalid map owners response');
    }
    return response.data.data;
  },
  async getOwnerProfile(ownerId: string): Promise<User & { deviceCount: number }> {
    const response = await apiClient.get(`/owner/${ownerId}/profile`);
    if (response.data?.success !== true || typeof response.data.data?._id !== 'string' ||
        response.data.data._id.toLowerCase() !== ownerId.toLowerCase()) {
      throw new Error('Invalid owner profile response');
    }
    return response.data.data;
  },
  async getOwnerDevices(ownerId: string): Promise<Device[]> {
    const response = await apiClient.get<{ success: boolean; data: Device[] }>(`/owner/${ownerId}/devices`);
    if (response.data?.success !== true || !Array.isArray(response.data.data)) {
      throw new Error('Invalid owner devices response');
    }
    return response.data.data;
  },
  /**
   * Lấy thông tin tài khoản & profile chi tiết của user hiện tại
   */
  async getProfile(): Promise<ProfileResponse> {
    const response = await apiClient.get<ProfileResponse>('/auth/me');
    return response.data;
  },

  /**
   * Cập nhật thông tin hồ sơ người dùng
   */
  async updateProfile(params: UpdateProfileParams): Promise<{ success: boolean; user: User; message: string }> {
    const response = await apiClient.put('/auth/me', params);
    return response.data;
  },

  /**
   * Tải ảnh đại diện trực tiếp lên Cloudinary (1-hop, cấu hình lấy từ server/.env)
   * rồi đồng bộ URL vào MongoDB, tự động fallback qua /auth/me/avatar nếu cần.
   */
  async uploadAvatar(uri: string): Promise<{ avatar: string }> {
    const result = await uploadImageWithCloudinary({
      uri,
      folder: 'techshare/avatars',
      filenamePrefix: 'avatar',
      fallbackEndpoint: '/auth/me/avatar',
      fallbackFieldName: 'avatar',
      directTimeoutMs: 12000,
    });

    if (!result.usedFallback) {
      await apiClient.put('/auth/me', { avatar: result.url });
    }

    return { avatar: result.url };
  },
};

export default userService;
