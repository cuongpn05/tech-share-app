import { apiClient } from '../config/api';
import {
  DeviceModerationItem,
  DeviceModerationDetailItem,
  ModerationTabCounts,
  GetModerationParams,
} from '../types';

export type DashboardPeriod = '7d' | '30d' | '90d' | 'year';
export type RentalVolumePoint = { date: string; amount: number };
export type DashboardBookingStatus = { status: string; count: number };
export type DashboardCategory = { id: string; name: string; count: number; percentage: number };

export interface AdminDashboardData {
  kpis: {
    totalUsers: number;
    verifiedUsers: number;
    totalDevices: number;
    availableDevices: number;
  };
  actionItems: {
    pendingEkyc: number;
    pendingOwnerEkyc: number;
    pendingDeviceApprovals: number;
  };
  categoryBreakdown: DashboardCategory[];
  analytics?: {
    period: DashboardPeriod;
    grossRentalVolume: number;
    volumeBookingCount: number;
    rentalVolumeTrend: RentalVolumePoint[];
    bookingStatuses: DashboardBookingStatus[];
  };
}

export interface ModerationResponse {
  devices: DeviceModerationItem[];
  counts: ModerationTabCounts;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export const adminService = {
  async getDashboard(period: DashboardPeriod, signal: AbortSignal): Promise<AdminDashboardData> {
    const { data } = await apiClient.get<{ success: boolean; data?: AdminDashboardData }>(
      '/admin/dashboard', { params: { period }, signal }
    );
    if (!data.success || !data.data) throw new Error('Invalid dashboard response');
    return data.data;
  },
  /**
   * Lấy danh sách thiết bị kiểm duyệt cho Admin Hub (Backlog #51)
   */
  getModerationDevices: async (params?: GetModerationParams): Promise<ModerationResponse> => {
    const queryParams: Record<string, string | number> = {};
    if (params?.status && params.status !== 'all') {
      queryParams.status = params.status;
    } else if (params?.status === 'all') {
      queryParams.status = 'all';
    }
    if (params?.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.limit) {
      queryParams.limit = params.limit;
    }

    const response = await apiClient.get('/admin/devices/moderation', {
      params: queryParams,
    });

    const data = response.data?.data || response.data;
    return {
      devices: Array.isArray(data?.devices) ? data.devices : [],
      counts: data?.counts || {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalAll: 0,
      },
      pagination: data?.pagination || {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
      },
    };
  },

  /**
   * Lấy chi tiết thiết bị kiểm duyệt cho Admin Hub (UC-A04)
   */
  getDeviceDetail: async (id: string): Promise<DeviceModerationDetailItem> => {
    const response = await apiClient.get(`/admin/devices/${id}`);
    const data = response.data?.data || response.data;
    return data;
  },

  /**
   * Phê duyệt thiết bị lên sàn
   */
  approveDevice: async (id: string) => {
    const response = await apiClient.patch(`/admin/devices/${id}/approve`);
    return response.data;
  },

  /**
   * Từ chối thiết bị kiểm duyệt
   */
  rejectDevice: async (id: string, reason: string) => {
    const response = await apiClient.patch(`/admin/devices/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};

export default adminService;
