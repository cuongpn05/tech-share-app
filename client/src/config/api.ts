import axios from 'axios';
import { Platform } from 'react-native';

// Địa chỉ API mặc định: Ưu tiên biến môi trường EXPO_PUBLIC_API_URL, fallback sang Emulator/Localhost
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor gán token hoặc header xác thực nếu có
apiClient.interceptors.request.use(
  async (config) => {
    // Có thể bổ sung lấy token từ AsyncStorage nếu có
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
