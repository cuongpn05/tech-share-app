import { API_BASE_URL, apiClient } from '../config/api';
import type { Device } from '../types';

export type CreateDevicePayload = {
  name: string;
  brand: string;
  category: string;
  description: string;
  images: string[];
  specs: Record<string, string>;
  pricePerDay: number;
  depositAmount: number;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  addressText: string;
};

export const devicePostService = {
  async getMyDevices(token: string): Promise<Device[]> {
    const response = await apiClient.get<{
      success?: boolean;
      data?: Device[];
    }>('/devices/myDevices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (
      response.data?.success !== true ||
      !Array.isArray(response.data.data) ||
      response.data.data.some(
        (device) =>
          !device ||
          typeof device._id !== 'string' ||
          typeof device.title !== 'string' ||
          typeof device.category !== 'string' ||
          !Number.isFinite(device.dailyRate) ||
          !Array.isArray(device.images) ||
          !['available', 'rented', 'maintenance', 'hidden'].includes(device.status),
      )
    ) {
      throw new Error('The server returned an invalid device list.');
    }
    return response.data.data;
  },

  async uploadDeviceImage(token: string, uri: string, index: number): Promise<string> {
    const formData = new FormData();
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    formData.append('image', {
      uri,
      name: `device-${Date.now()}-${index}.${extension}`,
      type: extension === 'png' ? 'image/png' : 'image/jpeg',
    } as unknown as Blob);

    const response = await apiClient.post('/devices/upload-image', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    const url: unknown = response.data?.data?.url;
    if (typeof url !== 'string' || !url) {
      throw new Error('The server did not return an uploaded image URL.');
    }
    if (url.startsWith('/')) {
      return `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;
    }
    return url;
  },

  async createDevice(token: string, payload: CreateDevicePayload): Promise<void> {
    await apiClient.post('/devices', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async deleteMyDevice(token: string, deviceId: string): Promise<void> {
    const response = await apiClient.delete<{
      success?: boolean;
      message?: string;
    }>(`/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || 'The server did not confirm device deletion.',
      );
    }
  },
};
