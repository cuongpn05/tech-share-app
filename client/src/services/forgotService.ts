/**
 * ============================================================
 *  FORGOT PASSWORD SERVICE  –  client/src/services/forgotService.ts
 * ============================================================
 *  Chứa toàn bộ logic gọi API và validate cho luồng Quên mật khẩu
 *  từ phía client (React Native / Expo).
 *  Tách riêng thành file độc lập để dễ bảo trì, tái sử dụng và báo cáo.
 *
 *  Bao gồm các hàm:
 *   - sendOtp()          : Bước 1 – Tìm kiếm tài khoản và gửi OTP qua email
 *   - verifyOtp()        : Bước 2 – Xác thực mã OTP 6 chữ số
 *   - resetPassword()    : Bước 3 – Đặt lại mật khẩu mới
 *   - resendOtp()        : Phụ – Gửi lại mã OTP khi hết hạn
 *   - validateStep1()    : Kiểm tra tính hợp lệ username / email
 *   - validateStep2()    : Kiểm tra định dạng mã OTP 6 số
 *   - validateStep3()    : Kiểm tra mật khẩu mới & xác nhận mật khẩu
 * ============================================================
 */

import apiClient from '../config/api';

// ─────────────────────────────────────────────────────────
//  Interfaces / Types
// ─────────────────────────────────────────────────────────

export interface SendOtpPayload {
  identifier: string; // username hoặc email
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  email: string;
  maskedEmail: string;
  expiresInSeconds?: number;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  email: string;
  resetToken: string;
}

export interface ResetPasswordPayload {
  email: string;
  resetToken: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResendOtpResponse {
  success: boolean;
  message: string;
  email: string;
  expiresInSeconds?: number;
}

// ─────────────────────────────────────────────────────────
//  Client-side Validations
// ─────────────────────────────────────────────────────────

export function validateStep1(identifier: string): { isValid: boolean; error: string | null } {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter your username or email.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username or email must be at least 3 characters.' };
  }
  return { isValid: true, error: null };
}

export function validateStep2(otp: string): { isValid: boolean; error: string | null } {
  const trimmed = otp.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter the 6-digit OTP code.' };
  }
  if (!/^\d{6}$/.test(trimmed)) {
    return { isValid: false, error: 'OTP must be a 6-digit number.' };
  }
  return { isValid: true, error: null };
}

export function validateStep3(
  newPassword: string,
  confirmPassword: string
): { isValid: boolean; passwordError: string | null; confirmError: string | null } {
  let passwordError: string | null = null;
  let confirmError: string | null = null;

  if (!newPassword) {
    passwordError = 'Please enter a new password.';
  } else if (newPassword.length < 6) {
    passwordError = 'Password must be at least 6 characters.';
  }

  if (!confirmPassword) {
    confirmError = 'Please confirm your new password.';
  } else if (newPassword !== confirmPassword) {
    confirmError = 'Passwords do not match.';
  }

  return {
    isValid: !passwordError && !confirmError,
    passwordError,
    confirmError,
  };
}

// ─────────────────────────────────────────────────────────
//  API Calls
// ─────────────────────────────────────────────────────────

/**
 * Bước 1: Gửi yêu cầu tìm tài khoản và gửi mã OTP qua email
 * Endpoint: POST /api/forgot-password/send-otp
 */
export async function sendOtp(identifier: string): Promise<SendOtpResponse> {
  const response = await apiClient.post<SendOtpResponse>('/forgot-password/send-otp', {
    identifier: identifier.trim().toLowerCase(),
  });
  return response.data;
}

/**
 * Bước 2: Xác thực mã OTP 6 chữ số
 * Endpoint: POST /api/forgot-password/verify-otp
 */
export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
  const response = await apiClient.post<VerifyOtpResponse>('/forgot-password/verify-otp', {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });
  return response.data;
}

/**
 * Bước 3: Đặt lại mật khẩu mới
 * Endpoint: POST /api/forgot-password/reset-password
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  const response = await apiClient.post<ResetPasswordResponse>('/forgot-password/reset-password', {
    email: payload.email.trim().toLowerCase(),
    resetToken: payload.resetToken,
    newPassword: payload.newPassword,
    confirmPassword: payload.confirmPassword,
  });
  return response.data;
}

/**
 * Phụ: Gửi lại mã OTP mới khi mã cũ hết hạn
 * Endpoint: POST /api/forgot-password/resend-otp
 */
export async function resendOtp(email: string): Promise<ResendOtpResponse> {
  const response = await apiClient.post<ResendOtpResponse>('/forgot-password/resend-otp', {
    email: email.trim().toLowerCase(),
  });
  return response.data;
}

export const forgotService = {
  sendOtp,
  verifyOtp,
  resetPassword,
  resendOtp,
  validateStep1,
  validateStep2,
  validateStep3,
};

export default forgotService;
