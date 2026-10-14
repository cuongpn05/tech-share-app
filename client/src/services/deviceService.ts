import { apiClient } from "../config/api";
import { Device, DeviceCategory } from "../types";
export const HOME_NEARBY_RADIUS_METERS = 10000;

export type DeviceSort = "price_asc" | "price_desc" | "rating_desc" | "newest";

export interface GetDevicesParams {
  category?: DeviceCategory | "all";
  search?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: DeviceSort;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface DevicePage {
  data: Device[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number; hasNextPage: boolean };
}


export const deviceService = {
  async getNearbyDevicesPage(params: GetDevicesParams): Promise<DevicePage> {
    if (!Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) {
      throw new Error("Nearby devices require your location");
    }
    const query = {
      lat: params.latitude, lng: params.longitude, radius: params.radius ?? HOME_NEARBY_RADIUS_METERS,
      category: params.category !== "all" ? params.category : undefined,
      q: (params.q || params.search || "").trim() || undefined,
      page: params.page || 1, limit: 10,
    };
    const debug = typeof __DEV__ !== 'undefined' && __DEV__;
    if (debug) console.log('[HOME NEARBY] request URL/params:', apiClient.getUri({ url: '/devices/nearby', params: query }), query);
    try {
      const response = await apiClient.get<DevicePage & { success: boolean }>("/devices/nearby", { params: query });
      const body = response.data;
      if (debug) {
        console.log('[HOME NEARBY] HTTP:', response.status);
        console.log('[HOME NEARBY] response shape:', Object.keys(body || {}));
        console.log('[HOME NEARBY] received:', body?.data?.length);
        console.log('[HOME NEARBY] pagination:', body?.pagination);
      }
      const pagination = body?.pagination;
      if (body?.success !== true || !Array.isArray(body.data) || !pagination ||
          !Number.isInteger(pagination.page) || pagination.page !== query.page ||
          pagination.limit !== 10 || !Number.isInteger(pagination.totalItems) ||
          !Number.isInteger(pagination.totalPages) || pagination.totalItems < 0 || pagination.totalPages < 0 || typeof pagination.hasNextPage !== 'boolean' ||
          body.data.length > 10 || body.data.some(d => !d || typeof d._id !== 'string' || !d._id || typeof d.name !== 'string' || !d.name.trim())) {
        throw new Error("Invalid nearby device response");
      }
      if (debug) console.log('[HOME NEARBY] invalid location count:', body.data.filter(d => {
        const c = d.location?.coordinates;
        return !c || c.length !== 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
      }).length);
      return body;
    } catch (error: any) {
      if (debug) console.log('[HOME NEARBY] HTTP:', error?.response?.status || error?.code || 'NETWORK_ERROR');
      throw error;
    }
  },

  /**
   * Lấy chi tiết thiết bị theo ID
   */
  async getDeviceById(
    id: string,
    options?: { throwOnError?: boolean },
  ): Promise<Device | null> {
    try {
      const response = await apiClient.get(`/devices/${id}`);
      if (response.data && response.data.data) {
        return response.data.data;
      }
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.error("[deviceService] Không thể lấy chi tiết thiết bị:", error);
      if (options?.throwOnError) throw error;
    }
    return null;
  },
};

