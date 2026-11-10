/**
 * ============================================================
 *  LOGOUT SERVICE  –  client/src/services/logoutService.ts
 * ============================================================
 *  Chứa toàn bộ logic chuẩn hóa quy trình đăng xuất (Logout Usecase)
 *  cho toàn bộ ứng dụng TechShare (Renter, Owner, Admin).
 *
 *  Các bước thực hiện khi logout:
 *   1. Gửi request POST /api/logout tới máy chủ (gỡ FCM token / ghi log)
 *   2. Ngắt kết nối Socket.IO thời gian thực (rời khỏi các phòng chat / room user)
 *   3. Xóa Authorization Token khỏi cấu hình apiClient (Axios headers)
 *   4. Xóa dữ liệu cache danh sách yêu thích (Wishlist cache)
 *   5. Reset toàn bộ trạng thái xác thực trong Redux store (clearAuth)
 *
 *  Các hàm export:
 *   - logoutUser(dispatch, options)    Thực hiện toàn bộ quy trình logout
 *   - confirmAndLogout(config)         Hiển thị hộp thoại xác nhận trước khi logout
 *   - clearLocalSession(dispatch)      Chỉ dọn dẹp local session (dùng khi bị khóa tài khoản/hết hạn)
 * ============================================================
 */

import { Alert } from 'react-native';
import apiClient, { setAuthToken } from '../config/api';
import socketService from './socketService';
import { clearAuth } from '../store/slices/authSlice';
import { clearWishlist } from '../store/slices/wishlistSlice';
import wishlistService from './wishlistService';
import { STRINGS } from '../constants/strings';

export interface LogoutOptions {
  fcmToken?: string;
  silent?: boolean;
}

export interface ConfirmLogoutParams {
  dispatch?: any;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  noticeText?: string;
  onBeforeLogout?: () => void;
  onAfterLogout?: () => void;
}

export type LogoutModalConfig = ConfirmLogoutParams & {
  isOpen: boolean;
};

type ModalListener = (config: LogoutModalConfig | null) => void;
let modalListener: ModalListener | null = null;

/**
 * Đăng ký listener nhận sự kiện hiển thị Logout Modal toàn cục.
 */
export function registerLogoutModalListener(
  listener: ModalListener | null
): () => void {
  modalListener = listener;
  return () => {
    if (modalListener === listener) {
      modalListener = null;
    }
  };
}

/**
 * Đóng Logout Modal toàn cục nếu đang mở.
 */
export function closeLogoutModal(): void {
  if (modalListener) {
    modalListener(null);
  }
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * Dọn dẹp toàn bộ dữ liệu phiên làm việc ở phía client (Socket, Token, Redux, Cache)
 */
export async function clearLocalSession(dispatch?: any): Promise<void> {
  try {
    // 1. Ngắt kết nối Socket.IO
    socketService.disconnect();
  } catch (err) {
    console.warn('[LogoutService] Lỗi ngắt kết nối Socket:', err);
  }

  try {
    // 2. Xóa header Authorization trong Axios
    setAuthToken(null);
  } catch (err) {
    console.warn('[LogoutService] Lỗi xóa axios auth token:', err);
  }

  try {
    // 3. Xóa cache và state wishlist
    wishlistService.clearCache();
    if (dispatch) {
      dispatch(clearWishlist());
    }
  } catch (err) {
    console.warn('[LogoutService] Lỗi dọn dẹp wishlist:', err);
  }

  try {
    // 4. Reset Auth Redux Store (đặt isAuthenticated = false, user = null, token = null)
    if (dispatch) {
      dispatch(clearAuth());
    }
  } catch (err) {
    console.warn('[LogoutService] Lỗi dispatch clearAuth:', err);
  }
}

/**
 * Thực hiện quy trình đăng xuất đầy đủ (Backend API + Client Cleanup)
 *
 * @param dispatch  Redux AppDispatch
 * @param options   Cấu hình bổ sung (fcmToken, silent)
 */
export async function logoutUser(
  dispatch: any,
  options?: LogoutOptions
): Promise<LogoutResponse> {
  // 1. Thông báo cho Backend (POST /api/logout)
  try {
    await apiClient.post<LogoutResponse>('/logout', {
      fcmToken: options?.fcmToken,
    });
  } catch (apiErr: any) {
    // Ngay cả khi mất kết nối mạng hoặc server trả lỗi, vẫn tiếp tục dọn dẹp client
    console.warn('[LogoutService] Lỗi gọi API /logout (tiếp tục dọn dẹp local):', apiErr?.message);
  }

  // 2. Dọn dẹp toàn bộ dữ liệu local
  await clearLocalSession(dispatch);

  return {
    success: true,
    message: 'Logged out successfully',
  };
}

/**
 * Hiển thị giao diện xác nhận đăng xuất đồng bộ và thực hiện đăng xuất nếu người dùng đồng ý.
 * Ưu tiên gọi Modal UI Soft-Teal chuẩn hệ thống thông qua listener toàn cục.
 */
export function confirmAndLogout({
  dispatch,
  title,
  message,
  confirmText,
  cancelText,
  noticeText,
  onBeforeLogout,
  onAfterLogout,
}: ConfirmLogoutParams): void {
  if (modalListener) {
    modalListener({
      dispatch,
      title,
      message,
      confirmText,
      cancelText,
      noticeText,
      onBeforeLogout,
      onAfterLogout,
      isOpen: true,
    });
    return;
  }

  const alertTitle = title || STRINGS.LOGOUT_MODAL.DEFAULT_TITLE;
  const alertMessage = message || STRINGS.LOGOUT_MODAL.DEFAULT_SUBTITLE;
  const btnConfirm = confirmText || STRINGS.LOGOUT_MODAL.DEFAULT_CONFIRM;
  const btnCancel = cancelText || STRINGS.LOGOUT_MODAL.DEFAULT_CANCEL;

  Alert.alert(
    alertTitle,
    alertMessage,
    [
      {
        text: btnCancel,
        style: 'cancel',
      },
      {
        text: btnConfirm,
        style: 'destructive',
        onPress: async () => {
          if (onBeforeLogout) {
            onBeforeLogout();
          }
          await logoutUser(dispatch);
          if (onAfterLogout) {
            onAfterLogout();
          }
        },
      },
    ],
    { cancelable: true }
  );
}

export default {
  logoutUser,
  clearLocalSession,
  confirmAndLogout,
  registerLogoutModalListener,
  closeLogoutModal,
};

