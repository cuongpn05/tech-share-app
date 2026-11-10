import axios from 'axios';
import { API_BASE_URL, apiClient } from '../config/api';

const cloudinaryClient = axios.create();

declare const process: {
  env: Record<string, string | undefined>;
};

export interface CloudinaryUnsignedConfig {
  cloudName: string;
  uploadPreset: string;
}

let cachedConfig: CloudinaryUnsignedConfig | null =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    ? {
        cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      }
    : null;

let pendingConfigPromise: Promise<CloudinaryUnsignedConfig | null> | null = null;

/**
 * Tải cấu hình Cloudinary unsigned upload từ server/.env (và cache trong bộ nhớ)
 * để thiết bị upload trực tiếp 1-hop lên Cloudinary CDN nhanh nhất.
 */
export async function preloadCloudinaryConfig(): Promise<CloudinaryUnsignedConfig | null> {
  if (cachedConfig?.cloudName && cachedConfig?.uploadPreset) {
    return cachedConfig;
  }
  if (pendingConfigPromise) {
    return pendingConfigPromise;
  }

  pendingConfigPromise = (async () => {
    try {
      const response = await apiClient.get<{
        success?: boolean;
        data?: { cloudName?: string; uploadPreset?: string };
      }>('/auth/cloudinary-config', { timeout: 3500 });

      const cloudName = response.data?.data?.cloudName?.trim() || '';
      const uploadPreset = response.data?.data?.uploadPreset?.trim() || '';
      if (cloudName && uploadPreset) {
        cachedConfig = { cloudName, uploadPreset };
        return cachedConfig;
      }
    } catch {
      // Bỏ qua nếu offline/lỗi tạm thời; sẽ fallback qua server upload
    } finally {
      pendingConfigPromise = null;
    }
    return cachedConfig;
  })();

  return pendingConfigPromise;
}

function getFileMetadata(uri: string, prefix: string) {
  const cleanUri = uri.split('?')[0];
  const rawExt = cleanUri.split('.').pop()?.toLowerCase() || 'jpg';
  const extension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
      ? 'image/webp'
      : extension === 'gif'
      ? 'image/gif'
      : 'image/jpeg';

  return {
    filename: `${prefix}-${Date.now()}.${extension}`,
    mimeType,
  };
}

function createImageFormData(
  fieldName: string,
  uri: string,
  filename: string,
  mimeType: string,
  extraFields?: Record<string, string>
): FormData {
  const formData = new FormData();
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      if (value) {
        formData.append(key, value);
      }
    });
  }
  formData.append(fieldName, {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
  return formData;
}

export interface UploadCloudinaryParams {
  uri: string;
  folder: string;
  filenamePrefix: string;
  fallbackEndpoint: string;
  fallbackFieldName?: string;
  directTimeoutMs?: number;
}

export interface UploadCloudinaryResult {
  url: string;
  usedFallback: boolean;
}

/**
 * Tải ảnh trực tiếp 1-hop lên Cloudinary CDN để tối đa tốc độ;
 * tự động fallback qua API Server nếu upload trực tiếp thất bại.
 */
export async function uploadImageWithCloudinary({
  uri,
  folder,
  filenamePrefix,
  fallbackEndpoint,
  fallbackFieldName = 'image',
  directTimeoutMs = 12000,
}: UploadCloudinaryParams): Promise<UploadCloudinaryResult> {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid image URI');
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return { url: uri, usedFallback: false };
  }

  const { filename, mimeType } = getFileMetadata(uri, filenamePrefix);
  const config = await preloadCloudinaryConfig();

  // 1. Direct upload 1-hop: Device -> Cloudinary CDN
  // Dùng Axios (XMLHttpRequest) thay vì fetch vì Expo fetch không hỗ trợ FormData part dạng { uri, name, type }
  if (config?.cloudName && config?.uploadPreset) {
    try {
      const directForm = createImageFormData('file', uri, filename, mimeType, {
        upload_preset: config.uploadPreset,
        folder,
      });

      const directRes = await cloudinaryClient.post<{ secure_url?: string }>(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
        directForm,
        {
          timeout: directTimeoutMs,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (typeof directRes.data?.secure_url === 'string' && directRes.data.secure_url) {
        return { url: directRes.data.secure_url, usedFallback: false };
      }
    } catch (directErr) {
      const detail = axios.isAxiosError(directErr)
        ? directErr.response?.data || directErr.message
        : directErr;
      console.warn('[CloudinaryUpload] Direct upload failed, falling back to server:', detail);
    }
  }

  // 2. Fallback qua API Server
  const serverForm = createImageFormData(fallbackFieldName, uri, filename, mimeType);

  const response = await apiClient.post<{
    success?: boolean;
    message?: string;
    data?: { url?: string; avatar?: string };
  }>(fallbackEndpoint, serverForm, {
    timeout: 35000,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const rawUrl = response.data?.data?.url || response.data?.data?.avatar;
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error(response.data?.message || 'Unable to upload image.');
  }

  const finalUrl = rawUrl.startsWith('/')
    ? `${API_BASE_URL.replace(/\/api\/?$/, '')}${rawUrl}`
    : rawUrl;

  return { url: finalUrl, usedFallback: true };
}

/**
 * Chèn Cloudinary transformation `f_auto,q_auto,w_<width>,c_limit` để tải và hiển thị ảnh nhanh hơn nhiều lần.
 */
export function optimizeCloudinaryUrl(url?: string | null, width = 800): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const marker = '/image/upload/';
  if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes(marker)) {
    return trimmed;
  }
  const idx = trimmed.indexOf(marker);
  const after = trimmed.slice(idx + marker.length);
  // Bỏ qua nếu URL đã có transform sẵn
  if (!/^v\d+\//.test(after) && after.includes(',') && after.includes('/')) {
    return trimmed;
  }
  return `${trimmed.slice(0, idx + marker.length)}f_auto,q_auto,w_${width},c_limit/${after}`;
}

