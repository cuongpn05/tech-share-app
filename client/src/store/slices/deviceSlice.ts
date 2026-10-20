import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Device, DeviceCategory } from '../../types';
import { deviceService, GetDevicesParams } from '../../services/deviceService';

export interface DeviceState {
  devices: Device[];
  filteredDevices: Device[];
  selectedCategory: DeviceCategory | 'all';
  searchQuery: string;
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  currentRequestId: string | null;
  page: number;
  totalPages: number;
  totalItems: number;
  failedPage: number | null;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  hasLoaded: boolean;
}

const initialState: DeviceState = {
  devices: [],
  filteredDevices: [],
  selectedCategory: 'all',
  searchQuery: '',
  isLoading: false,
  isInitialLoading: true,
  isRefreshing: false,
  error: null,
  currentRequestId: null,
  page: 0,
  totalPages: 0,
  totalItems: 0,
  failedPage: null,
  hasNextPage: false,
  isLoadingMore: false,
  hasLoaded: false,
};

let discoveryRequestNumber = 0;
const requestPage = async (params: GetDevicesParams | undefined, context: { requestId: string }) => {
  const requestNumber = ++discoveryRequestNumber;
  const logPrefix = `[HOME FILTER #${requestNumber}]`;
  const debug = typeof __DEV__ !== 'undefined' && __DEV__;
  if (debug) {
    console.log(logPrefix + ' ' + JSON.stringify({
      event: 'request',
      requestId: context.requestId,
      lat: params?.latitude,
      lng: params?.longitude,
      radius: params?.radius,
      category: params?.category === 'all' ? undefined : params?.category,
      q: (params?.q || params?.search || '').trim() || undefined,
      page: params?.page || 1,
      limit: 10,
    }));
  }
  try {
    const devicePage = params?.nearby === false
      ? await deviceService.getDevicesPage({ ...params, limit: 10 })
      : await deviceService.getNearbyDevicesPage({ ...params, limit: 10 });
    if (debug) {
      console.log(logPrefix + ' ' + JSON.stringify({
        event: 'response',
        requestId: context.requestId,
        count: devicePage.data.length,
        pagination: devicePage.pagination,
        ids: devicePage.data.map(device => device._id),
      }));
    }
    return devicePage;
  } catch (error) {
    if (debug) console.log(logPrefix + ' ' + JSON.stringify({ event: 'error', requestId: context.requestId }));
    throw error;
  }
};

export const fetchDevices = createAsyncThunk('devices/fetchDevices', requestPage);
export const refreshDevices = createAsyncThunk(
  'devices/refreshDevices',
  (params: GetDevicesParams | undefined, context) => requestPage({ ...params, page: 1 }, context),
);

function mergeDevicePages(existingDevices: Device[], receivedDevices: Device[], receivedPage: number): Device[] {
  const isFirstPage = receivedPage === 1;
  const combinedDevices = isFirstPage ? receivedDevices : [...existingDevices, ...receivedDevices];
  const seenDeviceIds = new Set<string>();

  return combinedDevices.filter(device => {
    if (seenDeviceIds.has(device._id)) return false;
    seenDeviceIds.add(device._id);
    return true;
  });
}

export const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<DeviceCategory | 'all'>) => {
      state.selectedCategory = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearFilters: state => {
      state.selectedCategory = 'all';
      state.searchQuery = '';
    },
    resetDeviceDiscovery: state => {
      state.devices = [];
      state.filteredDevices = [];
      state.page = 0;
      state.totalPages = 0;
      state.totalItems = 0;
      state.currentRequestId = null;
      state.error = null;
      state.failedPage = null;
      state.isLoading = false;
      state.isRefreshing = false;
      state.isInitialLoading = true;
      state.hasLoaded = false;
      state.hasNextPage = false;
      state.isLoadingMore = false;
    },
  },
  extraReducers: builder => {
    // Hai thunk có cùng ba bước; vòng lặp chỉ đăng ký handler, không gọi API.
    for (const thunk of [fetchDevices, refreshDevices]) {
      builder.addCase(thunk.pending, (state, action) => {
        const requestParams = action.meta.arg;
        const requestedPage = requestParams?.page || 1;
        const isRefreshRequest = action.type === refreshDevices.pending.type;
        const isLoadingNextPage = !isRefreshRequest && requestedPage > 1;
        const shouldResetResults = !isRefreshRequest && requestedPage === 1;

        state.isRefreshing = isRefreshRequest;
        state.isLoading = !isRefreshRequest;
        state.isLoadingMore = isLoadingNextPage;
        state.error = null;
        state.failedPage = null;
        state.currentRequestId = action.meta.requestId;
        if (requestParams?.category !== undefined) {
          state.selectedCategory = requestParams.category;
        }
        if (requestParams?.search !== undefined) {
          state.searchQuery = requestParams.search;
        }
        // Đổi danh mục hoặc vị trí phải bắt đầu trang 1, không giữ kết quả cũ.
        if (shouldResetResults) {
          state.devices = [];
          state.filteredDevices = [];
          state.page = 0;
          state.totalPages = 0;
          state.totalItems = 0;
          state.isInitialLoading = true;
          state.hasLoaded = false;
          state.hasNextPage = false;
        }
      });
      builder.addCase(thunk.fulfilled, (state, action) => {
        // Chỉ request mới nhất được cập nhật Redux, dù response cũ trả về sau.
        if (state.currentRequestId !== action.meta.requestId) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[HOME FILTER STALE] ignored ' + action.meta.requestId);
          return;
        }
        const { data: receivedDevices, pagination } = action.payload;
        state.devices = mergeDevicePages(state.devices, receivedDevices, pagination.page);
        state.filteredDevices = state.devices;
        state.page = pagination.page;
        state.totalPages = pagination.totalPages;
        state.totalItems = pagination.totalItems;
        state.hasNextPage = pagination.hasNextPage;
        state.hasLoaded = true;
        state.isLoadingMore = false;
        state.isLoading = false;
        state.isRefreshing = false;
        state.isInitialLoading = false;
      });
      builder.addCase(thunk.rejected, (state, action) => {
        // Lỗi của request cũ không được thay đổi trạng thái request hiện tại.
        if (state.currentRequestId !== action.meta.requestId) return;
        state.isLoading = false;
        state.isRefreshing = false;
        state.isInitialLoading = false;
        state.isLoadingMore = false;
        const requestedPage = action.meta.arg?.page || 1;
        const isRefreshRequest = action.type === refreshDevices.rejected.type;
        state.failedPage = isRefreshRequest ? 1 : requestedPage;
        state.error = action.error.message || 'Unable to load devices';
      });
    }
  },
});

export const { setSelectedCategory, setSearchQuery, clearFilters, resetDeviceDiscovery } = deviceSlice.actions;
export default deviceSlice.reducer;
