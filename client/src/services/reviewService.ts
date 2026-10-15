import { apiClient } from '../config/api';

export interface CreateReviewPayload {
  bookingId: string;
  rating: number; // 1–5 (Thiết bị)
  comment: string;
  ownerRating: number; // 1–5 (Chủ máy)
  ownerFeedback?: string;
  images?: string[];
}

export interface OwnerRateRenterPayload {
  renterTrustRating: number; // 1–5 (Ý thức khách thuê)
  renterFeedback?: string;
}

export interface ReviewItem {
  _id: string;
  bookingId: string;
  deviceId: any;
  renterId: any; // populated: { _id, name, avatar, trustScore }
  ownerId: any;
  rating: number;
  comment: string;
  ownerRating: number;
  ownerFeedback?: string;
  renterTrustRating?: number | null;
  renterFeedback?: string;
  images: string[];
  createdAt: string;
}

export const reviewService = {
  createReview: async (payload: CreateReviewPayload) => {
    const res = await apiClient.post('/reviews', payload);
    return res.data;
  },

  getDeviceReviews: async (deviceId: string): Promise<ReviewItem[]> => {
    const res = await apiClient.get(`/reviews/device/${deviceId}`);
    return res.data.data;
  },

  getBookingReview: async (bookingId: string): Promise<ReviewItem> => {
    const res = await apiClient.get(`/reviews/booking/${bookingId}`);
    return res.data.data;
  },

  // Chủ máy đánh giá ý thức khách thuê – cập nhật trustScore
  ownerRateRenter: async (
    reviewId: string,
    payload: OwnerRateRenterPayload
  ): Promise<{ renterTrustRating: number; delta: number }> => {
    const res = await apiClient.patch(`/reviews/${reviewId}/owner-rate`, payload);
    return res.data.data;
  },

  // Lấy tất cả review mà chủ máy hiện tại là ownerId (để hiển thị danh sách chấm điểm)
  getMyOwnerReviews: async (): Promise<ReviewItem[]> => {
    const res = await apiClient.get('/reviews/my-owner-reviews');
    return res.data.data;
  },
};
