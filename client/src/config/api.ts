import axios from 'axios';
import { Platform } from 'react-native';
import { NETWORK_CONFIG } from '../constants/app';

declare const process: {
  env: Record<string, string | undefined>;
};

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (Platform.OS === 'android') {
    return `http://${NETWORK_CONFIG.DEFAULT_EMULATOR_HOST}:${NETWORK_CONFIG.FALLBACK_PORT}/api`;
  }
  return `http://${NETWORK_CONFIG.DEFAULT_LOCALHOST}:${NETWORK_CONFIG.FALLBACK_PORT}/api`;
};

export const API_BASE_URL = getBaseUrl();

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
  (response) => response,
  (error) => {
    const requestUrl = String(error?.config?.url || '');
    const isLoginRequest = /\/login(?:\?|$)/i.test(requestUrl);
    if (
      !isLoginRequest &&
      error?.response?.status === 403 &&
      error?.response?.data?.code === 'ACCOUNT_LOCKED'
    ) {
      const reason = error.response.data.lockReason || error.response.data.message || '';
      if (accountLockedHandler) {
        accountLockedHandler(reason);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
