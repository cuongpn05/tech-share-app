import { apiClient } from '../config/api';
import { Device } from '../types';

let cachedWishlistIds: Set<string> | null = null;
let isFetchingIds = false;

export const wishlistService = {
  /**
   * Lấy danh sách thiết bị yêu thích từ server
   */
  getWishlist: async (): Promise<Device[]> => {
    try {
      const res = await apiClient.get('/profile/wishlist');
      const list: Device[] = res.data?.wishlist || [];
      cachedWishlistIds = new Set(list.map((d: any) => (d._id || d.id)?.toString()));
      return list;
    } catch (error) {
      console.warn('[wishlistService] Lỗi gọi API lấy danh sách yêu thích:', error);
      return [];
    }
  },

  /**
   * Thêm hoặc xoá thiết bị khỏi danh sách yêu thích (thả tim)
   */
  toggleWishlist: async (device: Device): Promise<{ isInWishlist: boolean; wishlist: Device[] }> => {
    const deviceId = (device._id || (device as any).id)?.toString();
    try {
      const res = await apiClient.post(`/profile/wishlist/toggle/${deviceId}`);
      const nextList: Device[] = res.data?.wishlist || [];
      cachedWishlistIds = new Set(nextList.map((d: any) => (d._id || d.id)?.toString()));
      return {
        isInWishlist: Boolean(res.data?.isInWishlist),
        wishlist: nextList,
      };
    } catch (err) {
      console.warn('[wishlistService] Lỗi cập nhật yêu thích:', err);
      return {
        isInWishlist: false,
        wishlist: [],
      };
    }
  },

  /**
   * Kiểm tra nhanh một thiết bị có trong danh sách yêu thích hay không
   */
  checkIsFavorite: async (deviceId: string): Promise<boolean> => {
    if (!deviceId) return false;
    const strId = deviceId.toString();

    if (cachedWishlistIds !== null) {
      return cachedWishlistIds.has(strId);
    }

    if (isFetchingIds) {
      return false;
    }

    isFetchingIds = true;
    try {
      const res = await apiClient.get('/profile/wishlist');
      const list: Device[] = res.data?.wishlist || [];
      cachedWishlistIds = new Set(list.map((d: any) => (d._id || d.id)?.toString()));
      return cachedWishlistIds.has(strId);
    } catch {
      return false;
    } finally {
      isFetchingIds = false;
    }
  },

  /**
   * Xoá cache bộ nhớ (khi user đăng xuất)
   */
  clearCache: () => {
    cachedWishlistIds = null;
    isFetchingIds = false;
  },
};

export default wishlistService;
