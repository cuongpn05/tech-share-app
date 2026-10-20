/**
 * ============================================================
 *  USER MANAGEMENT SERVICE
 *  client/src/services/userManagementService.ts
 * ============================================================
 *  Mục đích:
 *   - Tách riêng toàn bộ logic gọi API Quản lý Người dùng (User Management)
 *     ở Frontend ra khỏi component, chuẩn theo kiến trúc Layered Architecture.
 *   - Giúp sinh viên dễ giải thích luồng: Screen -> Service -> API -> Backend Controller.
 *   - Sẵn sàng cho việc mở rộng tính năng: Khóa tài khoản, xem chi tiết, phân quyền.
 * ============================================================
 */

import { apiClient } from '../config/api';

export interface MemberUser {
  _id          : string;
  accountId    : string;
  username     : string;
  name         : string;
  email        : string;
  phone        : string;
  avatar       : string | null;
  role         : 'renter' | 'owner';
  roleName     : string;
  isActive     : boolean;
  isVerified   : boolean;
  trustScore   : number;
  walletBalance: number;
  rating       : number;
  totalReviews : number;
  lastLogin    : string | null;
  joinedAt     : string;
}

export interface Pagination {
  page      : number;
  limit     : number;
  total     : number;
  totalPages: number;
  hasNext   : boolean;
  hasPrev   : boolean;
}

export interface UserQueryParams {
  search?: string;
  role?  : 'renter' | 'owner' | '';
  status?: 'active' | 'inactive' | '';
  page?  : number;
  limit? : number;
}

export interface UserListResponse {
  success   : boolean;
  message   : string;
  data      : MemberUser[];
  pagination: Pagination;
  filters   : {
    search: string;
    role  : string;
    status: string;
  };
}

export interface UserDetailResponse {
  success: boolean;
  message?: string;
  data   : any;
}

export interface ToggleStatusResponse {
  success: boolean;
  message: string;
  data?  : {
    userId  : string;
    isActive: boolean;
  };
}

/**
 * 1. Lấy danh sách thành viên (renter & owner, lọc và tìm kiếm)
 */
export async function fetchUsersList(params: UserQueryParams = {}): Promise<UserListResponse> {
  const queryRecord: Record<string, string> = {};

  if (params.page)                     queryRecord.page   = String(params.page);
  if (params.limit)                    queryRecord.limit  = String(params.limit);
  if (params.search && params.search.trim()) queryRecord.search = params.search.trim();
  if (params.role)                     queryRecord.role   = params.role;
  if (params.status)                   queryRecord.status = params.status;

  const queryString = new URLSearchParams(queryRecord).toString();
  const url = queryString ? `/admin/users?${queryString}` : '/admin/users';

  const response = await apiClient.get<UserListResponse>(url);
  return response.data;
}

/**
 * 2. Xem chi tiết thông tin một người dùng (Sẵn sàng cho nâng cấp sau)
 */
export async function fetchUserDetail(userId: string): Promise<UserDetailResponse> {
  const response = await apiClient.get<UserDetailResponse>(`/admin/users/${userId}`);
  return response.data;
}

/**
 * 3. Khóa hoặc Mở khóa tài khoản người dùng (Sẵn sàng cho nâng cấp sau)
 */
export async function toggleUserStatus(userId: string, isActive?: boolean): Promise<ToggleStatusResponse> {
  const response = await apiClient.patch<ToggleStatusResponse>(`/admin/users/${userId}/status`, {
    isActive,
  });
  return response.data;
}

export default {
  fetchUsersList,
  fetchUserDetail,
  toggleUserStatus,
};
