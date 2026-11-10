import axios from 'axios';
import { Platform } from 'react-native';
import { NETWORK_CONFIG } from '../constants/app';

declare const process: {
  env: Record<string, string | undefined>;
};

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const localApiUrl = `http://${NETWORK_CONFIG.DEFAULT_LOCALHOST}:${NETWORK_CONFIG.FALLBACK_PORT}/api`;
const emulatorApiUrl = `http://${NETWORK_CONFIG.DEFAULT_EMULATOR_HOST}:${NETWORK_CONFIG.FALLBACK_PORT}/api`;

const candidateBaseUrls = configuredApiUrl
  ? [configuredApiUrl]
  : Platform.OS === 'android'
    ? [emulatorApiUrl, localApiUrl]
    : [localApiUrl];

export const API_BASE_URL = candidateBaseUrls[0];

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
  timeout: NETWORK_CONFIG.API_TIMEOUT_MS,
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
      const currentIndex = originalConfig._attemptIndex ?? candidateBaseUrls.indexOf(originalConfig.baseURL);
      const nextIndex = currentIndex + 1;
      if (currentIndex >= 0 && nextIndex < candidateBaseUrls.length) {
        const nextUrl = candidateBaseUrls[nextIndex];
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[apiClient] Lỗi kết nối với ${originalConfig.baseURL}. Đang thử URL dự phòng (${nextIndex + 1}/${candidateBaseUrls.length}): ${nextUrl}`);
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
