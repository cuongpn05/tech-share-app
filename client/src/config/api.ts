import axios from 'axios';
import { Platform } from 'react-native';

declare const process: {
  env: Record<string, string | undefined>;
};

// Candidate base URLs: Tự động phát hiện và thử lần lượt nếu gặp Network Error
const CANDIDATE_BASE_URLS: string[] = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, ''),
      Platform.OS === 'android' ? 'http://localhost:5001/api' : undefined,
      Platform.OS === 'android' ? 'http://10.0.2.2:5001/api' : undefined,
      'http://10.10.101.212:5001/api',
      'http://localhost:5001/api',
    ].filter(Boolean) as string[]
  )
);

export const API_BASE_URL = CANDIDATE_BASE_URLS[0] || 'http://localhost:5001/api';

let currentToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => currentToken;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor tự động gán token xác thực cho mọi HTTP request
apiClient.interceptors.request.use(
  async (config) => {
    let token = currentToken;
    if (!token) {
      try {
        const { store } = require('../store');
        token = store.getState()?.auth?.token || null;
      } catch {
        // Store not yet available
      }
    }
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

type AccountLockedHandler = (reason: string) => void;
let accountLockedHandler: AccountLockedHandler | null = null;
export const setAccountLockedHandler = (handler: AccountLockedHandler | null) => {
  accountLockedHandler = handler;
};

apiClient.interceptors.response.use(
  (response) => {
    // Khi một URL dự phòng kết nối thành công, lưu lại làm baseURL mặc định cho mọi request tiếp theo
    if (response.config.baseURL && apiClient.defaults.baseURL !== response.config.baseURL) {
      apiClient.defaults.baseURL = response.config.baseURL;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[apiClient] Kết nối thành công, đặt baseURL mặc định: ${response.config.baseURL}`);
      }
    }
    return response;
  },
  async (error) => {
    const originalConfig = error.config as (typeof error.config & { _attemptIndex?: number });
    // Nếu gặp Network Error (máy ảo / máy thật không kết nối được IP hiện tại), tự động thử URL dự phòng
    if (!error.response && originalConfig) {
      const nextIndex = (originalConfig._attemptIndex ?? 0) + 1;
      if (nextIndex < CANDIDATE_BASE_URLS.length) {
        const nextUrl = CANDIDATE_BASE_URLS[nextIndex];
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[apiClient] Lỗi kết nối với ${originalConfig.baseURL}. Đang thử URL dự phòng (${nextIndex + 1}/${CANDIDATE_BASE_URLS.length}): ${nextUrl}`);
        }
        originalConfig._attemptIndex = nextIndex;
        originalConfig.baseURL = nextUrl;
        return apiClient(originalConfig);
      }
    }

    if (error?.response?.status === 403 && error?.response?.data?.code === 'ACCOUNT_LOCKED') {
      const reason = error.response.data.lockReason || error.response.data.message || '';
      if (accountLockedHandler) {
        accountLockedHandler(reason);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
