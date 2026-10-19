/**
 * ============================================================
 *  LOGIN SERVICE  –  client/src/services/loginService.ts
 * ============================================================
 *  Chứa toàn bộ logic gọi API liên quan đến đăng nhập từ phía client.
 *  Tách riêng khỏi các service khác để dễ bảo trì và báo cáo.
 *
 *  Các hàm được export:
 *   - loginWithCredentials()   Đăng nhập bằng username/email + password
 *   - validateLoginForm()      Kiểm tra form trước khi gọi API (client-side)
 * ============================================================
 */

import apiClient from '../config/api';
import { User }  from '../types';

// ─────────────────────────────────────────────────────────
//  Interfaces / Types
// ─────────────────────────────────────────────────────────

/** Dữ liệu cần gửi lên server khi đăng nhập */
export interface LoginCredentials {
  /** Username hoặc email của người dùng */
  identifier: string;
  /** Mật khẩu (plain text – HTTPS bảo vệ kênh truyền) */
  password: string;
}

/** Dữ liệu trả về từ server sau khi đăng nhập thành công */
export interface LoginResponse {
  success : boolean;
  message : string;
  /** JWT token thời hạn 7 ngày */
  token   : string;
  /** Thông tin đầy đủ của user vừa đăng nhập */
  user    : User;
}

/** Kết quả validate form phía client */
export interface LoginValidationResult {
  isValid       : boolean;
  identifierError: string | null;
  passwordError  : string | null;
}

// ─────────────────────────────────────────────────────────
//  Hàm validate form (client-side, không cần network)
// ─────────────────────────────────────────────────────────

/**
 * Kiểm tra form đăng nhập trước khi gọi API.
 * Dùng để hiển thị lỗi ngay lập tức mà không cần chờ server.
 *
 * @param credentials  Thông tin người dùng nhập vào
 * @returns            Kết quả validate với thông báo lỗi cụ thể
 */
export function validateLoginForm(credentials: LoginCredentials): LoginValidationResult {
  let identifierError: string | null = null;
  let passwordError  : string | null = null;

  // Kiểm tra identifier
  if (!credentials.identifier || credentials.identifier.trim() === '') {
    identifierError = 'Vui lòng nhập tên đăng nhập hoặc email.';
  }

  // Kiểm tra password
  if (!credentials.password || credentials.password.trim() === '') {
    passwordError = 'Vui lòng nhập mật khẩu.';
  } else if (credentials.password.length < 6) {
    passwordError = 'Mật khẩu phải có ít nhất 6 ký tự.';
  }

  return {
    isValid       : !identifierError && !passwordError,
    identifierError,
    passwordError,
  };
}

// ─────────────────────────────────────────────────────────
//  Gọi API đăng nhập
// ─────────────────────────────────────────────────────────

/**
 * Gọi endpoint POST /api/login để xác thực người dùng.
 *
 * Server nhận: { identifier, password }
 * Server trả:  { success, token, user }
 *
 * @param credentials  Username/email và password
 * @returns            LoginResponse chứa token và thông tin user
 * @throws             Error nếu server trả về lỗi hoặc mất kết nối
 */
export async function loginWithCredentials(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/login', {
    identifier: credentials.identifier.trim().toLowerCase(),
    password  : credentials.password,
  });

  return response.data;
}

/**
 * Tập hợp export dưới dạng object để dễ import theo kiểu named:
 *   import { loginService } from '../services/loginService';
 *   await loginService.login({ identifier, password });
 */
export const loginService = {
  /** Đăng nhập bằng username/email và password */
  login    : loginWithCredentials,

  /** Validate form trước khi gọi API */
  validate : validateLoginForm,
};

export default loginService;
