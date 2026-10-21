import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Device } from '../../types';
import { apiClient } from '../../config/api';
import { clearAuth } from './authSlice';

export interface WishlistState {
  items: Device[];
  favoriteIds: string[];
  loading: boolean;
  error: string | null;
}

const initialState: WishlistState = {
  items: [],
  favoriteIds: [],
  loading: false,
  error: null,
};

export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get('/profile/wishlist');
      const list: Device[] = res.data?.wishlist || [];
      return list;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Không thể tải danh sách yêu thích');
    }
  }
);

export const toggleFavoriteDevice = createAsyncThunk(
  'wishlist/toggleFavoriteDevice',
  async (device: Device, { rejectWithValue }) => {
    const deviceId = (device._id || (device as any).id)?.toString();
    try {
      const res = await apiClient.post(`/profile/wishlist/toggle/${deviceId}`);
      return {
        deviceId,
        device,
        isInWishlist: Boolean(res.data?.isInWishlist),
        wishlist: (res.data?.wishlist || []) as Device[],
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Không thể cập nhật danh sách yêu thích');
    }
  }
);

export const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlist: (state) => {
      state.items = [];
      state.favoriteIds = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Tự động làm sạch khi đăng xuất
      .addCase(clearAuth, (state) => {
        state.items = [];
        state.favoriteIds = [];
        state.loading = false;
        state.error = null;
      })
      // fetchWishlist
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.favoriteIds = action.payload.map((d) => (d._id || (d as any).id).toString());
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // toggleFavoriteDevice
      .addCase(toggleFavoriteDevice.pending, (state, action) => {
        // Cập nhật Optimistic UI tức thì trên icon trái tim
        const device = action.meta.arg;
        const deviceId = (device._id || (device as any).id)?.toString();
        const exists = state.favoriteIds.includes(deviceId);
        if (exists) {
          state.favoriteIds = state.favoriteIds.filter((id) => id !== deviceId);
          state.items = state.items.filter((d) => (d._id || (d as any).id)?.toString() !== deviceId);
        } else {
          state.favoriteIds.push(deviceId);
          state.items.unshift(device);
        }
      })
      .addCase(toggleFavoriteDevice.fulfilled, (state, action) => {
        const { deviceId, isInWishlist, wishlist } = action.payload;
        if (Array.isArray(wishlist)) {
          state.items = wishlist;
          state.favoriteIds = wishlist.map((d) => (d._id || (d as any).id).toString());
        } else {
          if (isInWishlist) {
            if (!state.favoriteIds.includes(deviceId)) {
              state.favoriteIds.push(deviceId);
            }
          } else {
            state.favoriteIds = state.favoriteIds.filter((id) => id !== deviceId);
            state.items = state.items.filter((d) => (d._id || (d as any).id)?.toString() !== deviceId);
          }
        }
      })
      .addCase(toggleFavoriteDevice.rejected, (state, action) => {
        // Hoàn tác nếu gọi server thất bại
        const device = action.meta.arg;
        const deviceId = (device._id || (device as any).id)?.toString();
        const exists = state.favoriteIds.includes(deviceId);
        if (exists) {
          state.favoriteIds = state.favoriteIds.filter((id) => id !== deviceId);
          state.items = state.items.filter((d) => (d._id || (d as any).id)?.toString() !== deviceId);
        } else {
          state.favoriteIds.push(deviceId);
          state.items.unshift(device);
        }
        state.error = action.payload as string;
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
