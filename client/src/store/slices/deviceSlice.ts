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
  devices: [], filteredDevices: [], selectedCategory: 'all', searchQuery: '',
  isLoading: false, isInitialLoading: true, isRefreshing: false,
  error: null, currentRequestId: null, page: 0, totalPages: 0, totalItems: 0, failedPage: null, hasNextPage: false, isLoadingMore: false, hasLoaded: false,
};

let discoveryRequestNumber = 0;
const requestPage = async (params: GetDevicesParams | undefined, context: { requestId: string }) => {
  const number = ++discoveryRequestNumber;
  const tag = `[HOME FILTER #${number}]`;
  const debug = typeof __DEV__ !== 'undefined' && __DEV__;
  if (debug) console.log(tag + ' ' + JSON.stringify({ event: 'request', requestId: context.requestId,
    lat: params?.latitude, lng: params?.longitude, radius: params?.radius,
    category: params?.category === 'all' ? undefined : params?.category,
    q: (params?.q || params?.search || '').trim() || undefined, page: params?.page || 1, limit: 10 }));
  try {
    const result = await deviceService.getNearbyDevicesPage({ ...params, limit: 10 });
    if (debug) console.log(tag + ' ' + JSON.stringify({ event: 'response', requestId: context.requestId,
      count: result.data.length, pagination: result.pagination, ids: result.data.map(device => device._id) }));
    return result;
  } catch (error) {
    if (debug) console.log(tag + ' ' + JSON.stringify({ event: 'error', requestId: context.requestId }));
    throw error;
  }
};

export const fetchDevices = createAsyncThunk('devices/fetchDevices', requestPage);
export const refreshDevices = createAsyncThunk('devices/refreshDevices',
  (params: GetDevicesParams | undefined, context) => requestPage({ ...params, page: 1 }, context));

export const deviceSlice = createSlice({
  name: 'devices', initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<DeviceCategory | 'all'>) => {
      state.selectedCategory = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearFilters: state => {
      state.selectedCategory = 'all'; state.searchQuery = '';
    },
    resetDeviceDiscovery: state => {
      state.devices = []; state.filteredDevices = []; state.page = 0;
      state.totalPages = 0; state.totalItems = 0; state.currentRequestId = null;
      state.error = null; state.failedPage = null; state.isLoading = false; state.isRefreshing = false;
      state.isInitialLoading = true; state.hasLoaded = false; state.hasNextPage = false; state.isLoadingMore = false;
    },
  },
  extraReducers: builder => {
    for (const thunk of [fetchDevices, refreshDevices]) {
      builder.addCase(thunk.pending, (state, action) => {
        state.isRefreshing = action.type === refreshDevices.pending.type;
        state.isLoading = !state.isRefreshing;
        state.isLoadingMore = !state.isRefreshing && (action.meta.arg?.page || 1) > 1;
        state.error = null;
        state.failedPage = null;
        state.currentRequestId = action.meta.requestId;
        if (action.meta.arg?.category !== undefined) state.selectedCategory = action.meta.arg.category;
        if (action.meta.arg?.search !== undefined) state.searchQuery = action.meta.arg.search;
        // A new filter/location must not expose results from the old query.
        if (!state.isRefreshing && (action.meta.arg?.page || 1) === 1) {
          state.devices = []; state.filteredDevices = []; state.page = 0;
          state.totalPages = 0; state.totalItems = 0; state.isInitialLoading = true; state.hasLoaded = false; state.hasNextPage = false;
        }
      });
      builder.addCase(thunk.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[HOME FILTER STALE] ignored ' + action.meta.requestId);
          return;
        }
        const { data, pagination } = action.payload;
        const seen = new Set<string>();
        const combined = pagination.page === 1 ? data : [...state.devices, ...data];
        state.devices = combined.filter(device => {
          if (seen.has(device._id)) return false;
          seen.add(device._id);
          return true;
        });
        state.filteredDevices = state.devices;
        state.page = pagination.page; state.totalPages = pagination.totalPages;
        state.totalItems = pagination.totalItems; state.hasNextPage = pagination.hasNextPage;
        state.hasLoaded = true; state.isLoadingMore = false;
        state.isLoading = false; state.isRefreshing = false; state.isInitialLoading = false;
      });
      builder.addCase(thunk.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.isLoading = false; state.isRefreshing = false; state.isInitialLoading = false;
        state.isLoadingMore = false;
        state.failedPage = action.type === refreshDevices.rejected.type ? 1 : (action.meta.arg?.page || 1);
        state.error = action.error.message || 'Unable to load nearby devices';
      });
    }
  },
});

export const { setSelectedCategory, setSearchQuery, clearFilters, resetDeviceDiscovery } = deviceSlice.actions;
export default deviceSlice.reducer;
