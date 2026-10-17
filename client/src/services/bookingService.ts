import { apiClient } from '../config/api';

export interface ExtensionRequestInfo {
  requestedEndDate?: string;
  requestedDays?: number;
  additionalFee?: number;
  status?: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface BookingTimelineItem {
  status: string;
  timestamp?: string;
  note?: string;
}

export interface Booking {
  _id: string;
  bookingCode: string;
  deviceId: any;
  renterId: any;
  ownerId: any;
  startDate: string;
  endDate: string;
  totalDays: number;
  pricePerDayAtBooking?: number;
  rentalFee?: number;
  depositFee?: number;
  voucherDiscount?: number;
  voucherCode?: string;
  totalAmount: number;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled' | 'rejected' | 'disputed';
  paymentStatus: 'unpaid' | 'deposit_held' | 'paid' | 'refunded' | 'disputed';
  deliveryMethod?: 'pickup' | 'delivery' | string;
  deliveryAddress?: string;
  rejectReason?: string;
  cancelReason?: string;
  qrToken?: string;
  handoverPhotos?: {
    beforeRental?: string[];
    afterRental?: string[];
  };
  conditionNotes?: {
    before?: string;
    after?: string;
  };
  extensionRequest?: ExtensionRequestInfo;
  timeline?: BookingTimelineItem[];
  isReviewed?: boolean;
  reviewId?: string;
  createdAt: string;
}


export const bookingService = {
  createBooking: async (payload: any) => {
    const res = await apiClient.post('/bookings', payload);
    return res.data;
  },

  getMyBookings: async (status?: string): Promise<Booking[]> => {
    const res = await apiClient.get('/bookings/my-bookings', {
      params: status ? { status } : {},
    });
    return res.data.data;
  },

  getBookingById: async (bookingId: string): Promise<Booking> => {
    const res = await apiClient.get(`/bookings/${bookingId}`);
    return res.data.data;
  },

  cancelBooking: async (bookingId: string, reason: string): Promise<Booking> => {
    const res = await apiClient.put(`/bookings/${bookingId}/cancel`, { reason });
    return res.data.data;
  },

  requestExtension: async (bookingId: string, additionalDays: number): Promise<Booking> => {
    const res = await apiClient.post(`/bookings/${bookingId}/extend`, { additionalDays });
    return res.data.data;
  },

  respondExtension: async (
    bookingId: string,
    action: 'approve' | 'reject',
    rejectReason?: string
  ): Promise<Booking> => {
    const res = await apiClient.put(`/bookings/${bookingId}/respond-extension`, {
      action,
      rejectReason,
    });
    return res.data.data;
  },

  getOwnerBookings: async (status?: string): Promise<Booking[]> => {
    const res = await apiClient.get('/bookings/owner-bookings', {
      params: status ? { status } : {},
    });
    return res.data.data;
  },

  updateBookingStatusByOwner: async (
    bookingId: string,
    status: 'approved' | 'rejected' | 'active' | 'completed',
    reason?: string
  ): Promise<Booking> => {
    const res = await apiClient.patch(`/bookings/${bookingId}/status`, {
      status,
      reason,
    });
    return res.data.data;
  },

  handoverBooking: async (bookingId: string): Promise<Booking> => {
    const res = await apiClient.patch(`/bookings/${bookingId}/handover`);
    return res.data.data;
  },

  completeBooking: async (bookingId: string): Promise<Booking> => {
    const res = await apiClient.patch(`/bookings/${bookingId}/complete`);
    return res.data.data;
  },

  getDeviceBusyDates: async (
    deviceId: string
  ): Promise<{
    _id: string;
    startDate: string;
    endDate: string;
    status: string;
    bookingCode?: string;
    type?: 'booking' | 'blocked';
    reason?: string;
  }[]> => {
    const res = await apiClient.get(`/bookings/busy-dates/${deviceId}`);
    return res.data.busyRanges || [];
  },

  getDeviceSchedule: async (
    deviceId: string
  ): Promise<{
    busyRanges: {
      _id: string;
      startDate: string;
      endDate: string;
      status: string;
      bookingCode?: string;
      type?: 'booking' | 'blocked';
      reason?: string;
    }[];
    bookedBookings: {
      _id: string;
      startDate: string;
      endDate: string;
      status: string;
      bookingCode?: string;
      type?: 'booking';
    }[];
    blockedDates: {
      _id: string;
      startDate: string;
      endDate: string;
      status: string;
      reason?: string;
      type?: 'blocked';
    }[];
  }> => {
    const res = await apiClient.get(`/bookings/busy-dates/${deviceId}`);
    return {
      busyRanges: res.data.busyRanges || [],
      bookedBookings: res.data.bookedBookings || [],
      blockedDates: res.data.blockedDates || [],
    };
  },

  updateBeforeRentalPhotos: async (
    bookingId: string,
    photos: string[],
    conditionNotes?: string
  ): Promise<Booking> => {
    const res = await apiClient.patch(`/bookings/${bookingId}/handover-renter`, {
      photos,
      conditionNotes,
    });
    return res.data.data;
  },

  verifyHandoverQr: async (
    payload: string | { qrToken?: string; bookingCode?: string; bookingId?: string }
  ): Promise<Booking> => {
    const body = typeof payload === 'string' ? { qrToken: payload } : payload;
    const res = await apiClient.post('/bookings/verify-qr', body);
    return res.data?.data || res.data?.booking || res.data;
  },
};
