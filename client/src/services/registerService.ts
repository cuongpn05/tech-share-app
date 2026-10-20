/**
 * ============================================================
 *  REGISTER SERVICE  –  client/src/services/registerService.ts
 * ============================================================
 *  Chứa toàn bộ logic gọi API liên quan đến ĐĂNG KÝ tài khoản
 *  từ phía client (React Native / Expo).
 *  Tách riêng khỏi RegisterScreen để dễ bảo trì và báo cáo.
 *
 *  3 hàm chính:
 *   - validateRegisterForm()  Kiểm tra form bước 1 (client-side)
 *   - sendOtp()               Gọi POST /api/register/send-otp
 *   - verifyOtp()             Gọi POST /api/register/verify-otp
 *   - resendOtp()             Gọi POST /api/register/resend-otp
 * ============================================================
 */

import apiClient from '../config/api';
import { User }  from '../types';

// ─────────────────────────────────────────────────────────
//  Interfaces / Types
// ─────────────────────────────────────────────────────────

/** Dữ liệu form bước 1: Thông tin cá nhân */
export interface RegisterFormData {
  username       : string;
  name           : string;
  email          : string;
  phone          : string;
  password       : string;
  confirmPassword: string;
}

/** Dữ liệu gửi lên server ở bước 1 (bỏ confirmPassword) */
export interface SendOtpPayload {
  username: string;
  name    : string;
  email   : string;
  phone   : string;
  password: string;
}

/** Response từ POST /api/register/send-otp */
export interface SendOtpResponse {
  success         : boolean;
  message         : string;
  email           : string;
  expiresInSeconds: number;
}

/** Dữ liệu gửi lên server ở bước 2 */
export interface VerifyOtpPayload {
  email: string;
  otp  : string;
}

/** Response từ POST /api/register/verify-otp */
export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  /** JWT token thời hạn 7 ngày */
  token  : string;
  /** Thông tin user vừa tạo xong */
  user   : User;
}

/** Kết quả validate form bước 1 (client-side) */
export interface RegisterValidationResult {
  isValid         : boolean;
  usernameError   : string | null;
  nameError       : string | null;
  emailError      : string | null;
  phoneError      : string | null;
  passwordError   : string | null;
  confirmPwError  : string | null;
}

// ─────────────────────────────────────────────────────────
//  Hàm validate form bước 1 (client-side, không cần mạng)
// ─────────────────────────────────────────────────────────

/**
 * Kiểm tra form đăng ký bước 1 trước khi gọi API.
 * Dùng để hiển thị lỗi ngay lập tức mà không cần chờ server.
 *
 * @param data  Dữ liệu từ form đăng ký
 * @returns     Kết quả validate kèm thông báo lỗi cụ thể từng trường
 */
export function validateRegisterForm(data: RegisterFormData): RegisterValidationResult {
  let usernameError : string | null = null;
  let nameError     : string | null = null;
  let emailError    : string | null = null;
  let phoneError    : string | null = null;
  let passwordError : string | null = null;
  let confirmPwError: string | null = null;

  const trimmedUsername = data.username.trim();
  const trimmedEmail    = data.email.trim();
  const trimmedPhone    = data.phone.trim();

  // Validate username
  if (!trimmedUsername) {
    usernameError = 'Vui lòng nhập tên đăng nhập.';
  } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
    usernameError = 'Tên đăng nhập 3–30 ký tự, chỉ dùng chữ cái, số hoặc dấu gạch dưới (_).';
  }

  // Validate họ và tên
  if (!data.name.trim()) {
    nameError = 'Vui lòng nhập họ và tên của bạn.';
  }

  // Validate email
  if (!trimmedEmail) {
    emailError = 'Vui lòng nhập địa chỉ email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    emailError = 'Địa chỉ email không đúng định dạng.';
  }

  // Validate số điện thoại
  if (!trimmedPhone) {
    phoneError = 'Vui lòng nhập số điện thoại.';
  } else if (!/^[0-9+]{9,15}$/.test(trimmedPhone.replace(/[\s.-]/g, ''))) {
    phoneError = 'Số điện thoại không hợp lệ. Vui lòng nhập 9–15 chữ số.';
  }

  // Validate mật khẩu
  if (!data.password) {
    passwordError = 'Vui lòng nhập mật khẩu.';
  } else if (data.password.length < 6) {
    passwordError = 'Mật khẩu phải có ít nhất 6 ký tự.';
  }

  // Validate xác nhận mật khẩu
  if (!data.confirmPassword) {
    confirmPwError = 'Vui lòng nhập lại mật khẩu để xác nhận.';
  } else if (data.password !== data.confirmPassword) {
    confirmPwError = 'Mật khẩu và xác nhận mật khẩu không trùng khớp.';
  }

  return {
    isValid       : !usernameError && !nameError && !emailError && !phoneError && !passwordError && !confirmPwError,
    usernameError,
    nameError,
    emailError,
    phoneError,
    passwordError,
    confirmPwError,
  };
}

// ─────────────────────────────────────────────────────────
//  Bước 1: Gọi API gửi OTP
// ─────────────────────────────────────────────────────────

/**
 * Gửi thông tin đăng ký lên server.
 * Server sẽ validate, lưu tạm và gửi OTP 6 số qua email.
 *
 * Endpoint: POST /api/register/send-otp
 *
 * @param payload  Thông tin đăng ký (không bao gồm confirmPassword)
 * @returns        SendOtpResponse
 */
export async function sendOtp(payload: SendOtpPayload): Promise<SendOtpResponse> {
  const response = await apiClient.post<SendOtpResponse>('/register/send-otp', {
    username: payload.username.trim().toLowerCase(),
    name    : payload.name.trim(),
    email   : payload.email.trim().toLowerCase(),
    phone   : payload.phone.trim(),
    password: payload.password,
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────
//  Bước 2: Gọi API xác thực OTP → Tạo tài khoản
// ─────────────────────────────────────────────────────────

/**
 * Xác thực mã OTP và hoàn tất đăng ký.
 * Server tạo Account + User document và trả về JWT token.
 *
 * Endpoint: POST /api/register/verify-otp
 *
 * @param payload  { email, otp }
 * @returns        VerifyOtpResponse chứa token và thông tin user
 */
export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const response = await apiClient.post<VerifyOtpResponse>('/register/verify-otp', {
    email: payload.email.trim().toLowerCase(),
    otp  : payload.otp.trim(),
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────
//  Phụ: Gọi API gửi lại OTP
// ─────────────────────────────────────────────────────────

/**
 * Yêu cầu server sinh OTP mới và gửi lại email.
 * Dùng khi OTP hết hạn hoặc không nhận được email.
 *
 * Endpoint: POST /api/register/resend-otp
 *
 * @param email  Email của phiên đăng ký đang chờ xác thực
 * @returns      SendOtpResponse
 */
export async function resendOtp(email: string): Promise<SendOtpResponse> {
  const response = await apiClient.post<SendOtpResponse>('/register/resend-otp', {
    email: email.trim().toLowerCase(),
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────
//  Named export dưới dạng object (dễ import theo kiểu service)
// ─────────────────────────────────────────────────────────

/**
 * Dùng như:
 *   import { registerService } from '../services/registerService';
 *   await registerService.sendOtp({ username, name, email, phone, password });
 *   await registerService.verifyOtp({ email, otp });
 *   await registerService.resendOtp(email);
 */
export const registerService = {
  /** Validate form đăng ký bước 1 (client-side) */
  validate  : validateRegisterForm,

  /** Bước 1 – Gửi OTP qua email */
  sendOtp,

  /** Bước 2 – Xác thực OTP và tạo tài khoản */
  verifyOtp,

  /** Phụ – Gửi lại OTP khi hết hạn */
  resendOtp,
};

export default registerService;
