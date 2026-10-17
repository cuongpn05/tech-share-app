/**
 * Chuỗi văn bản chuẩn cho phân hệ Quản trị Admin Hub
 * Tuân thủ web-coding-rules.md: KHÔNG HARDCODE chuỗi trong component
 */

export const ADMIN_STRINGS = {
  COMMON: {
    COMING_SOON: 'Tính năng đang được phát triển',
  },
  HEADER: {
    TITLE: 'TechShare Admin Hub',
  },
  SECTIONS: {
    PERFORMANCE: 'Platform Performance Overview',
    ACTION_ITEMS: 'Action Items',
    CATEGORY_BREAKDOWN: 'Rental Category Breakdown',
  },
  KPIS: {
    RENTAL_VOLUME: {
      LABEL: 'Gross Rental Volume',
      DEFAULT_VALUE: '0 VND',
      TREND: '',
    },
    USERS: {
      LABEL: 'Users',
      DEFAULT_VALUE: '0 Accounts',
      SUBTITLE: '0 Verified • 0 Active',
    },
    DEVICES: {
      LABEL: 'Total Devices',
      DEFAULT_VALUE: '0 Units',
      SUBTITLE: '0 Rented • 0 Available',
    },
    ORDERS: {
      LABEL: 'Rental Orders',
      DEFAULT_VALUE: '0 Orders',
      SUBTITLE: '0 Active • 0 Completed',
    },
  },
  ACTION_ITEMS: {
    STATUS_OK: 'System operating smoothly • No pending disputes or verification requests',
  },
  CATEGORIES: {
    CAMERAS: 'Cameras & Lenses',
    LAPTOPS: 'Graphic Laptops',
    SMARTPHONES: 'Smartphones',
    GAMING: 'Gaming & Drones',
  },
  SIDEBAR: {
    PROFILE: {
      NAME: 'Administrator',
      EMAIL: '',
    },
    SECTION_HEADER: 'SYSTEM ADMINISTRATION',
    MENU: {
      DASHBOARD: 'Dashboard & KPIs',
      USERS: 'User Management',
      DEVICES: 'Device Moderation',
      DISPUTES: 'Deposit Disputes',
      EKYC: 'eKYC Reviews',
      VOUCHERS: 'Vouchers & Promotions',
    },
    SIGN_OUT: 'Sign Out of Admin Session',
  },
  MODERATION: {
    HEADER_TITLE: 'Kiểm duyệt thiết bị',
    HEADER_SUBTITLE: 'Danh sách và trạng thái kiểm duyệt thiết bị',
    SEARCH_PLACEHOLDER: 'Tìm theo tên thiết bị, hãng, chủ máy...',
    TABS: {
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Đã từ chối',
    },
    STATUS_LABELS: {
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Đã từ chối',
    },
    LABELS: {
      PRICE_UNIT: 'đ/ngày',
      DEPOSIT_LABEL: 'Cọc',
      TRUST_SCORE: 'Trust',
      POSTED_AT: 'Đăng',
      REJECT_REASON: 'Lý do từ chối',
      CATEGORY: 'Danh mục',
      BRAND: 'Hãng',
      OWNER: 'Chủ máy',
      DETAIL_HINT: 'Chạm để xem chi tiết kiểm duyệt',
    },
    EMPTY_STATES: {
      PENDING: 'Không có thiết bị nào đang chờ duyệt',
      APPROVED: 'Chưa có thiết bị nào được phê duyệt',
      REJECTED: 'Không có thiết bị nào bị từ chối',
      ALL: 'Không tìm thấy thiết bị nào phù hợp',
      SUBTITLE: 'Dữ liệu sẽ tự động cập nhật khi có tin đăng mới',
    },
    ERRORS: {
      TITLE: 'Lỗi',
      LOAD_FAILED: 'Không thể tải danh sách thiết bị kiểm duyệt',
      FORBIDDEN: 'Bạn không có quyền truy cập khu vực kiểm duyệt của Quản trị viên',
      APPROVE_FAILED: 'Không thể phê duyệt thiết bị. Vui lòng thử lại.',
      REJECT_FAILED: 'Không thể từ chối thiết bị. Vui lòng thử lại.',
      RETRY: 'Thử lại',
    },
    ACCESSIBILITY: {
      BACK_BUTTON: 'Quay lại Admin Hub',
      MENU_BUTTON: 'Mở trình đơn',
      SEARCH_CLEAR: 'Xóa tìm kiếm',
      FILTER_TAB: 'Lọc theo trạng thái',
      DEVICE_CARD: 'Thẻ thiết bị kiểm duyệt',
    },
    ACTIONS: {
      APPROVE: 'Duyệt',
      REJECT: 'Từ chối',
      CONFIRM_APPROVE_TITLE: 'Phê duyệt thiết bị',
      CONFIRM_APPROVE_MSG: 'Xác nhận duyệt thiết bị này lên sàn TechShare?',
      REJECT_MODAL_TITLE: 'Lý do từ chối thiết bị',
      REJECT_MODAL_SUBTITLE: 'Chọn hoặc nhập lý do từ chối gửi cho chủ máy',
      REJECT_REASON_PLACEHOLDER: 'Nhập lý do chi tiết...',
      CONFIRM_REJECT: 'Xác nhận từ chối',
      CANCEL: 'Hủy',
      APPROVE_SUCCESS: 'Đã duyệt thiết bị thành công',
      REJECT_SUCCESS: 'Đã từ chối thiết bị',
      DEFAULT_REASONS: [
        'Ảnh chụp không rõ nét / thiếu ảnh thực tế',
        'Thông số kỹ thuật hoặc mô tả sai lệch',
        'Giá thuê hoặc tiền cọc bất thường',
        'Thiết bị vi phạm chính sách nền tảng',
      ],
    },
  },
} as const;

export default ADMIN_STRINGS;
