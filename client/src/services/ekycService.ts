/**
 * ============================================================
 *  EKYC SERVICE
 *  client/src/services/ekycService.ts
 * ============================================================
 *  Mục đích:
 *   - Quản lý các cuộc gọi API liên quan đến Định danh điện tử (eKYC).
 *   - Lấy trạng thái xác thực eKYC của người dùng hiện tại.
 *   - Tải ảnh CCCD (mặt trước / mặt sau) lên Cloudinary qua Server.
 *   - Gửi đơn yêu cầu xác thực eKYC lên cơ sở dữ liệu.
 * ============================================================
 */

import { apiClient } from '../config/api';

export interface EkycProfile {
  _id    : string;
  name   : string;
  email  : string;
  phone  : string;
  address: string;
  avatar : string | null;
}

export interface EkycRequestData {
  _id           : string;
  idCardNumber  : string;
  idCardFrontUrl: string;
  idCardBackUrl : string;
  selfieUrl     : string;
  status        : 'pending' | 'approved' | 'rejected';
  rejectReason  : string;
  createdAt     : string;
}

export interface EkycStatusResponse {
  success: boolean;
  message?: string;
  data: {
    isVerified : boolean;
    hasAddress : boolean;
    profile    : EkycProfile;
    ekycRequest: EkycRequestData | null;
  };
}

export interface SubmitEkycPayload {
  idCardNumber  : string;
  idCardFrontUrl: string;
  idCardBackUrl : string;
  selfieUrl?    : string;
}

export interface SubmitEkycResponse {
  success: boolean;
  message: string;
  data?  : EkycRequestData;
  code?  : string;
}

/**
 * 1. Lấy trạng thái eKYC & thông tin profile của người dùng
 */
export async function getEkycStatus(): Promise<EkycStatusResponse> {
  const response = await apiClient.get<EkycStatusResponse>('/ekyc/status');
  return response.data;
}

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'oigtlazh';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'techshare_avatar';

/**
 * 2. Tải ảnh CCCD lên Cloudinary với tốc độ cao
 * - Chiến lược: Thử tải trực tiếp lên Cloudinary CDN (nhanh gấp 3-5 lần, không phụ thuộc server)
 * - Dự phòng (Fallback): Nếu Direct Upload không thành công, tải qua server với timeout 60s
 */
export async function uploadEkycPhoto(uri: string, prefix = 'cccd'): Promise<string> {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Đường dẫn ảnh không hợp lệ.');
  }

  // Nếu là URL đã lưu trên web/Cloudinary thì không upload lại
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const rawExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const extension = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  const filename = `${prefix}-${Date.now()}.${extension}`;

  // ── Thử nghiệm 1: Upload trực tiếp lên Cloudinary (Siêu nhanh, giảm tải server) ──
  try {
    const directForm = new FormData();
    directForm.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    directForm.append('folder', 'techshare/ekyc');
    directForm.append('file', {
      uri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const directRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: directForm,
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (directRes.ok) {
      const data = await directRes.json();
      if (data?.secure_url) {
        return data.secure_url;
      }
    }
  } catch (directErr) {
    console.warn('[EkycService] Direct upload không thành công, chuyển sang server fallback:', directErr);
  }

  // ── Thử nghiệm 2: Fallback qua API Server với timeout 60s ──
  const serverForm = new FormData();
  serverForm.append('image', {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const response = await apiClient.post<{ success: boolean; data?: { url: string }; message?: string }>(
    '/ekyc/upload-image',
    serverForm,
    {
      timeout: 60000, // Cho phép tối đa 60 giây để không bao giờ bị Network Error
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  const url = response.data?.data?.url;
  if (!url) {
    throw new Error(response.data?.message || 'Không thể tải ảnh CCCD lên máy chủ.');
  }

  return url;
}

/**
 * 3. Gửi đơn xác thực danh tính eKYC
 */
export async function submitEkycRequest(payload: SubmitEkycPayload): Promise<SubmitEkycResponse> {
  const response = await apiClient.post<SubmitEkycResponse>('/ekyc/submit', payload);
  return response.data;
}

export default {
  getEkycStatus,
  uploadEkycPhoto,
  submitEkycRequest,
};
