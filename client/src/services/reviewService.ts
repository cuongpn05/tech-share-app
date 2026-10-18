import { apiClient } from '../config/api';

export interface CreateReviewPayload {
  bookingId: string;
  rating: number; // 1–5 (Đánh giá chung / Thiết bị & Dịch vụ)
  comment: string;
  ownerRating?: number; // 1–5 (Tự động đồng bộ với rating nếu không truyền)
  ownerFeedback?: string;
  images?: string[];
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

  // Lấy tất cả review mà chủ máy hiện tại là ownerId
  getMyOwnerReviews: async (): Promise<ReviewItem[]> => {
    const res = await apiClient.get('/reviews/my-owner-reviews');
    return res.data.data;
  },
};
