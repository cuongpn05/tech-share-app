import { apiClient } from '../config/api';

export interface OwnerAnalyticsDevice {
  _id: string;
  name: string;
  status: string;
  rentalCount?: number;
  revenueTotal?: number;
}

export interface OwnerAnalyticsBooking {
  _id: string;
  rentalFee: number;
  startDate: string;
  endDate: string;
  updatedAt?: string;
  deviceId: string | { _id: string; name?: string };
  renterId: string | { _id: string; name?: string };
}

export interface OwnerRevenueByDay {
  date: string;
  day: string;
  revenue: number;
}

export interface OwnerAnalyticsData {
  totalRevenue: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  totalDevices: number;
  totalBookings: number;
  completedBookingsCount: number;
  rentedDevices: number;
  availableDevices: number;
  utilizationRate: number;
  walletBalance: number;
  escrowHolding: number;
  rating: number;
  trustScore: number;
  totalReviews: number;
  revenueByDay: OwnerRevenueByDay[];
  devices: OwnerAnalyticsDevice[];
  bookings: OwnerAnalyticsBooking[];
}

interface OwnerAnalyticsApiResponse {
  success: boolean;
  message?: string;
  data?: OwnerAnalyticsData;
}

export const ownerAnalyticsService = {
  getOwnerAnalytics: async (token: string): Promise<OwnerAnalyticsData> => {
    const response = await apiClient.get<OwnerAnalyticsApiResponse>('/owner/analytics', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Unable to load analytics data.');
    }

    return response.data.data;
  },
};
