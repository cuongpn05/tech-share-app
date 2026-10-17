import { apiClient } from '../config/api';
import {
  DeviceModerationItem,
  ModerationTabCounts,
  GetModerationParams,
} from '../types';

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
