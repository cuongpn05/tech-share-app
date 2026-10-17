import apiClient from '../config/api';
import { User } from '../types';

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

export const userService = {
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
};

export default userService;
