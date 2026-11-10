import { apiClient } from "../config/api";
import {
  BlockedDate,
  Device,
  DeviceCategory,
  ManagedDeviceStatus,
} from "../types";
export const HOME_NEARBY_RADIUS_METERS = 50000;

export type DeviceSort = "price_asc" | "price_desc" | "rating_desc" | "newest";

export interface GetDevicesParams {
  nearby?: boolean;
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
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  isRadiusExpanded?: boolean;
}

// Kiểm tra dữ liệu trước khi Redux dùng để hiển thị và phân trang.
function validateDevicePageResponse(
  responseBody: DevicePage & { success: boolean },
  requestedPage: number,
): void {
  const pagination = responseBody?.pagination;
  if (
    responseBody?.success !== true ||
    !Array.isArray(responseBody.data) ||
    !pagination
  ) {
    throw new Error("Invalid device page response");
  }

  const isValidPagination =
    Number.isInteger(pagination.page) &&
    pagination.page === requestedPage &&
    pagination.limit === 10 &&
    Number.isInteger(pagination.totalItems) &&
    pagination.totalItems >= 0 &&
    Number.isInteger(pagination.totalPages) &&
    pagination.totalPages >= 0 &&
    typeof pagination.hasNextPage === "boolean";
  if (!isValidPagination) {
    throw new Error("Invalid device page response");
  }

  const hasInvalidDevice = responseBody.data.some(
    (device) =>
      !device ||
      typeof device._id !== "string" ||
      !device._id ||
      typeof device.name !== "string" ||
      !device.name.trim(),
  );
  if (responseBody.data.length > 10 || hasInvalidDevice) {
    throw new Error("Invalid device page response");
  }
}

export const deviceService = {
  async getCategories(): Promise<DeviceCategory[]> {
    const response = await apiClient.get('/devices/categories');
    if (response.data?.success !== true || !Array.isArray(response.data.data) ||
        response.data.data.some((category: unknown) => typeof category !== 'string')) {
      throw new Error('Invalid device categories response');
    }
    return response.data.data;
  },

  async getDevicesPage(params: GetDevicesParams): Promise<DevicePage> {
    const page = params.page || 1;
    const response = await apiClient.get('/devices', { params: {
      page, limit: 10,
      category: params.category !== 'all' ? params.category : undefined,
      q: (params.q || params.search || '').trim() || undefined,
    } });
    validateDevicePageResponse(response.data, page);
    return response.data;
  },
  async getDevices(
    params?: Pick<GetDevicesParams, "limit">,
  ): Promise<Device[]> {
    const response = await apiClient.get<{ success: boolean; data: Device[] }>(
      "/devices",
      {
        params: { limit: params?.limit },
      },
    );

    if (response.data?.success !== true || !Array.isArray(response.data.data)) {
      throw new Error("Invalid available devices response");
    }

    return response.data.data;
  },

  async getRecommendedDevices(limit = 6): Promise<Device[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: Device[] }>("/devices", {
        params: { limit: 100 },
      });
      if (response.data?.success && Array.isArray(response.data.data)) {
        const sorted = [...response.data.data].sort((a, b) => {
          const ratingA = a.stats?.ratingAvg ?? a.rating ?? 0;
          const ratingB = b.stats?.ratingAvg ?? b.rating ?? 0;
          return ratingB - ratingA;
        });
        return sorted.slice(0, limit);
      }
    } catch {
      // Fallback empty array
    }
    return [];
  },

  /**
   * ============================================================================
   * getNearbyDevicesPage
   *
   * MỤC ĐÍCH:
   * Lấy danh sách thiết bị gần tọa độ người dùng có phân trang (pagination) từ MongoDB.
   *
   * QUY TRÌNH HOẠT ĐỘNG:
   * 1. Gửi kinh độ (lng), vĩ độ (lat) của người dùng lên server.
   * 2. Bán kính mặc định: 50,000 mét (50 km).
   * 3. Cơ chế Tự động mở rộng (Auto-Expand Radius):
   *    Nếu trong 50 km tìm thấy < 5 thiết bị, app tự động gọi lại API mở rộng
   *    bán kính lên 100 km (100,000m) để người dùng luôn có đủ thiết bị để khám phá.
   * 4. Sắp xếp: Thiết bị gần nhất đứng đầu (MongoDB $geoNear distanceField).
   * ============================================================================
   */
  async getNearbyDevicesPage(params: GetDevicesParams): Promise<DevicePage> {
    if (
      !Number.isFinite(params.latitude) ||
      !Number.isFinite(params.longitude)
    ) {
      throw new Error("Nearby devices require your location");
    }
    const requestParams = {
      lat: params.latitude,
      lng: params.longitude,
      radius: params.radius ?? HOME_NEARBY_RADIUS_METERS,
      category: params.category !== "all" ? params.category : undefined,
      q: (params.q || params.search || "").trim() || undefined,
      page: params.page || 1,
      limit: 10,
    };
    const debug = typeof __DEV__ !== "undefined" && __DEV__;
    if (debug)
      console.log(
        "[HOME NEARBY] request URL/params:",
        apiClient.getUri({ url: "/devices/nearby", params: requestParams }),
        requestParams,
      );
    try {
      const response = await apiClient.get<DevicePage & { success: boolean }>(
        "/devices/nearby",
        { params: requestParams },
      );
      let responseBody = response.data;
      if (debug) {
        console.log("[HOME NEARBY] HTTP:", response.status);
        console.log(
          "[HOME NEARBY] response shape:",
          Object.keys(responseBody || {}),
        );
        console.log("[HOME NEARBY] received:", responseBody?.data?.length);
        console.log("[HOME NEARBY] pagination:", responseBody?.pagination);
      }
      validateDevicePageResponse(responseBody, requestParams.page);

      // Auto-expand radius: If fewer than 5 suitable devices found within 50km, expand to 100km
      const foundCount = responseBody.pagination?.totalItems ?? responseBody.data.length;
      if (foundCount < 5 && requestParams.radius <= 50000) {
        try {
          const expandedParams = { ...requestParams, radius: 100000 };
          const expandedResponse = await apiClient.get<DevicePage & { success: boolean }>(
            "/devices/nearby",
            { params: expandedParams },
          );
          if (expandedResponse.data?.success && Array.isArray(expandedResponse.data.data)) {
            validateDevicePageResponse(expandedResponse.data, requestParams.page);
            responseBody = {
              ...expandedResponse.data,
              isRadiusExpanded: true,
            };
          }
        } catch {
          // If expanded request fails, keep the 50km response
        }
      }

      if (debug) {
        const invalidLocationCount = responseBody.data.filter((device) => {
          const coordinates = device.location?.coordinates;
          return (
            !coordinates ||
            coordinates.length !== 2 ||
            !Number.isFinite(coordinates[0]) ||
            !Number.isFinite(coordinates[1]) ||
            Math.abs(coordinates[0]) > 180 ||
            Math.abs(coordinates[1]) > 90
          );
        }).length;
        console.log(
          "[HOME NEARBY] invalid location count:",
          invalidLocationCount,
        );
      }
      return responseBody;
    } catch (error: unknown) {
      if (debug) {
        const requestError = error as {
          response?: { status?: number };
          code?: string;
        } | null;
        const errorCode =
          requestError?.response?.status ||
          requestError?.code ||
          "NETWORK_ERROR";
        console.log("[HOME NEARBY] HTTP:", errorCode);
      }
      throw error;
    }
  },

  async getNearbyDevices(params: Pick<GetDevicesParams, 'latitude' | 'longitude' | 'radius' | 'category'>): Promise<Device[]> {
    if (typeof params.latitude !== 'number' || !Number.isFinite(params.latitude) || Math.abs(params.latitude) > 90 ||
        typeof params.longitude !== 'number' || !Number.isFinite(params.longitude) || Math.abs(params.longitude) > 180) {
      throw new Error('Nearby devices require a valid location');
    }
    // The existing endpoint returns the full radius when page/limit are omitted.
    const response = await apiClient.get('/devices/nearby', { params: {
      lat: params.latitude, lng: params.longitude,
      radius: params.radius ?? HOME_NEARBY_RADIUS_METERS,
      category: params.category !== 'all' ? params.category : undefined,
    } });
    if (response.data?.success !== true || !Array.isArray(response.data.data) ||
        response.data.data.some((device: Device) => !device || typeof device._id !== 'string')) {
      throw new Error('Invalid nearby devices response');
    }
    return response.data.data;
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
      const body = response.data;
      if (body?.success === true && typeof body.data?._id === 'string' &&
          body.data._id.toLowerCase() === id.toLowerCase()) {
        return body.data;
      }
      throw new Error('Invalid device detail response');
    } catch (error) {
      console.error("[deviceService] Không thể lấy chi tiết thiết bị:", error);
      if (options?.throwOnError) throw error;
    }
    return null;
  },

  async updateDeviceStatus(
    token: string,
    deviceId: string,
    status: ManagedDeviceStatus,
  ): Promise<void> {
    const response = await apiClient.patch(
      `/devices/${deviceId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.data?.success !== true) {
      throw new Error("The server did not confirm the device status update.");
    }
  },

  async updateBlockedDates(
    token: string,
    deviceId: string,
    blockedDates: BlockedDate[],
  ): Promise<void> {
    const response = await apiClient.patch(
      `/devices/${deviceId}/blocked-dates`,
      { blockedDates },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || "The server did not confirm the availability update.",
      );
    }
  },
};
