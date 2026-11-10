/**
 * ============================================================
 *  EKYC SERVICE
 *  client/src/services/ekycService.ts
 * ============================================================
 *  Mục đích:
 *   - Quản lý các cuộc gọi API liên quan đến Định danh điện tử (eKYC) Renter
 *     và eKYC nâng cấp Renter đã xác thực lên Owner (`owner_ekyc_requests`).
 *   - Tải ảnh CCCD / chân dung cầm CCCD lên Cloudinary.
 *   - Phục vụ Admin duyệt/từ chối đơn eKYC Renter và Owner Upgrade eKYC.
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
  role?  : 'renter' | 'owner' | 'admin';
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

export interface OwnerEkycRequestData {
  _id            : string;
  idCardNumber   : string;
  idCardFrontUrl : string;
  idCardBackUrl  : string;
  selfieWithIdUrl: string;
  status         : 'pending' | 'approved' | 'rejected';
  rejectReason   : string;
  reviewedAt?    : string | null;
  createdAt      : string;
}

export interface EkycStatusResponse {
  success: boolean;
  message?: string;
  data: {
    isVerified       : boolean;
    hasAddress       : boolean;
    profile          : EkycProfile;
    ekycRequest      : EkycRequestData | null;
    ownerEkycRequest?: OwnerEkycRequestData | null;
  };
}

export interface OwnerEkycStatusResponse {
  success: boolean;
  message?: string;
  data: {
    role            : 'renter' | 'owner' | 'admin';
    isRenterVerified: boolean;
    isOwner         : boolean;
    hasAddress      : boolean;
    profile         : EkycProfile;
    renterEkyc      : {
      _id         : string;
      idCardNumber: string;
      status      : 'pending' | 'approved' | 'rejected';
    } | null;
    ownerEkycRequest: OwnerEkycRequestData | null;
  };
}

export interface SubmitEkycPayload {
  idCardNumber  : string;
  idCardFrontUrl: string;
  idCardBackUrl : string;
  selfieUrl?    : string;
}

export interface SubmitOwnerEkycPayload {
  idCardNumber   : string;
  idCardFrontUrl : string;
  idCardBackUrl  : string;
  selfieWithIdUrl: string;
}

export interface SubmitEkycResponse {
  success: boolean;
  message: string;
  data?  : EkycRequestData;
  code?  : string;
}

export interface SubmitOwnerEkycResponse {
  success: boolean;
  message: string;
  data?  : OwnerEkycRequestData;
  code?  : string;
}

/**
 * 1. Lấy trạng thái eKYC & thông tin profile của người dùng
 */
export async function getEkycStatus(): Promise<EkycStatusResponse> {
  const response = await apiClient.get<EkycStatusResponse>('/ekyc/status');
  return response.data;
}

/**
 * 1b. Lấy trạng thái eKYC nâng cấp Owner của người dùng
 */
export async function getOwnerEkycStatus(): Promise<OwnerEkycStatusResponse> {
  const response = await apiClient.get<OwnerEkycStatusResponse>('/ekyc/owner/status');
  return response.data;
}

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'oigtlazh';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'techshare_avatar';

/**
 * 2. Tải ảnh CCCD / chân dung lên Cloudinary với tốc độ cao
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

  // ── Thử nghiệm 1: Upload trực tiếp lên Cloudinary ──
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
    const timer = setTimeout(() => controller.abort(), 20000);

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
      timeout: 60000,
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
 * 3. Gửi đơn xác thực danh tính eKYC (Renter)
 */
export async function submitEkycRequest(payload: SubmitEkycPayload): Promise<SubmitEkycResponse> {
  const response = await apiClient.post<SubmitEkycResponse>('/ekyc/submit', payload);
  return response.data;
}

/**
 * 3b. Gửi đơn eKYC nâng cấp Renter đã xác thực lên Owner
 */
export async function submitOwnerEkycRequest(
  payload: SubmitOwnerEkycPayload
): Promise<SubmitOwnerEkycResponse> {
  const response = await apiClient.post<SubmitOwnerEkycResponse>('/ekyc/owner/submit', payload);
  return response.data;
}

// ─────────────────────────────────────────────────────────
//  Phân hệ Admin: Quản lý duyệt eKYC (Renter & Owner Upgrade)
// ─────────────────────────────────────────────────────────

export interface AdminEkycUser {
  _id     : string | null;
  name    : string;
  email   : string;
  phone   : string;
  address : string;
  avatar  : string | null;
  role?   : string;
  joinedAt: string | null;
}

export interface AdminEkycItem {
  _id            : string;
  idCardNumber   : string;
  idCardFrontUrl : string;
  idCardBackUrl  : string;
  selfieUrl      : string;
  selfieWithIdUrl?: string;
  status         : 'pending' | 'approved' | 'rejected';
  rejectReason   : string;
  reviewedAt     : string | null;
  createdAt      : string;
  user           : AdminEkycUser;
}

export interface AdminEkycCounts {
  totalAll     : number;
  totalPending : number;
  totalApproved: number;
  totalRejected: number;
}

export interface AdminEkycListParams {
  status?: string;
  search?: string;
  page?  : number;
  limit? : number;
}

export interface AdminEkycListResponse {
  success   : boolean;
  message   : string;
  data      : AdminEkycItem[];
  counts    : AdminEkycCounts;
  pagination: {
    page       : number;
    limit      : number;
    total      : number;
    totalPages : number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: {
    status: string;
    search: string;
  };
}

async function fetchAdminEkycEndpoint(
  basePath: string,
  params: AdminEkycListParams = {}
): Promise<AdminEkycListResponse> {
  const queryRecord: Record<string, string> = {};

  if (params.page) queryRecord.page = String(params.page);
  if (params.limit) queryRecord.limit = String(params.limit);
  if (params.status && params.status !== 'all') queryRecord.status = params.status;
  if (params.search && params.search.trim()) queryRecord.search = params.search.trim();

  const queryString = new URLSearchParams(queryRecord).toString();
  const url = queryString ? `${basePath}?${queryString}` : basePath;

  const response = await apiClient.get<AdminEkycListResponse>(url);
  return response.data;
}

/**
 * 4. Lấy danh sách đơn eKYC Renter dành cho Admin
 */
export async function getAdminEkycList(
  params: AdminEkycListParams = {}
): Promise<AdminEkycListResponse> {
  return fetchAdminEkycEndpoint('/admin/ekyc', params);
}

/**
 * 4b. Lấy danh sách đơn eKYC nâng cấp Owner dành cho Admin
 */
export async function getAdminOwnerEkycList(
  params: AdminEkycListParams = {}
): Promise<AdminEkycListResponse> {
  return fetchAdminEkycEndpoint('/admin/owner-ekyc', params);
}

/**
 * 5. Phê duyệt đơn xác thực eKYC Renter (Admin)
 */
export async function approveAdminEkyc(
  submissionId: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await apiClient.patch<{ success: boolean; message: string; data?: any }>(
    `/admin/ekyc/${submissionId}/approve`
  );
  return response.data;
}

/**
 * 6. Từ chối đơn xác thực eKYC Renter kèm lý do (Admin)
 */
export async function rejectAdminEkyc(
  submissionId: string,
  reason: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await apiClient.patch<{ success: boolean; message: string; data?: any }>(
    `/admin/ekyc/${submissionId}/reject`,
    { reason }
  );
  return response.data;
}

/**
 * 7. Phê duyệt đơn eKYC nâng cấp Renter lên Owner (Admin)
 */
export async function approveAdminOwnerEkyc(
  submissionId: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await apiClient.patch<{ success: boolean; message: string; data?: any }>(
    `/admin/owner-ekyc/${submissionId}/approve`
  );
  return response.data;
}

/**
 * 8. Từ chối đơn eKYC nâng cấp Owner kèm lý do (Admin)
 */
export async function rejectAdminOwnerEkyc(
  submissionId: string,
  reason: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await apiClient.patch<{ success: boolean; message: string; data?: any }>(
    `/admin/owner-ekyc/${submissionId}/reject`,
    { reason }
  );
  return response.data;
}

export default {
  getEkycStatus,
  getOwnerEkycStatus,
  uploadEkycPhoto,
  submitEkycRequest,
  submitOwnerEkycRequest,
  getAdminEkycList,
  getAdminOwnerEkycList,
  approveAdminEkyc,
  rejectAdminEkyc,
  approveAdminOwnerEkyc,
  rejectAdminOwnerEkyc,
};
