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
    DETAIL: {
      HEADER_TITLE: 'Chi tiết kiểm duyệt',
      HEADER_SUBTITLE: 'Thẩm định hồ sơ tin đăng thiết bị',
      BACK_BUTTON: 'Quay lại danh sách kiểm duyệt',
      LOADING: 'Đang tải thông tin chi tiết...',
      SECTIONS: {
        GALLERY: 'Hình ảnh thực tế',
        PRICING: 'Bảng giá & Đặt cọc',
        SPECS: 'Thông số kỹ thuật',
        ACCESSORIES: 'Phụ kiện kèm theo',
        DESCRIPTION: 'Mô tả chi tiết',
        LOCATION: 'Địa chỉ nhận máy',
        OWNER: 'Thông tin chủ máy',
        REJECT_INFO: 'Lý do từ chối kiểm duyệt',
      },
      LABELS: {
        PRICE_PER_DAY: 'Giá thuê theo ngày',
        DEPOSIT_AMOUNT: 'Tiền đặt cọc',
        YEAR: 'Năm sản xuất',
        CONDITION: 'Tình trạng máy',
        POSTED_DATE: 'Ngày đăng bài',
        NO_SPECS: 'Chưa có thông số kỹ thuật chi tiết',
        NO_ACCESSORIES: 'Không có phụ kiện kèm theo',
        NO_DESCRIPTION: 'Không có mô tả chi tiết',
        NO_IMAGES: 'Không có hình ảnh',
        VERIFIED_OWNER: 'Chủ máy đã xác thực eKYC',
        UNVERIFIED_OWNER: 'Chưa xác thực danh tính',
        PHONE: 'Điện thoại',
        EMAIL: 'Email',
        TRUST_SCORE: 'Điểm tín nhiệm',
        RATING: 'Đánh giá',
        TOTAL_RENTALS: 'Lượt cho thuê',
        IMAGE_INDEX: 'Ảnh',
      },
      CONDITIONS: {
        NEW99: 'Mới 99% (Nguyên bản, không trầy)',
        USED95: 'Đã qua sử dụng 95% (Trầy xước nhẹ)',
        SCRATCHED: 'Có hao mòn / trầy xước',
      },
      ACTIONS: {
        APPROVE_NOW: 'Phê duyệt thiết bị',
        REJECT_NOW: 'Từ chối duyệt',
        REVOKE_NOW: 'Gỡ bài đăng',
        RE_APPROVE_NOW: 'Duyệt lại thiết bị',
        APPROVE_SUCCESS: 'Đã duyệt thiết bị thành công',
        REJECT_SUCCESS: 'Đã từ chối thiết bị',
        ALREADY_APPROVED: 'Đã phê duyệt',
        ALREADY_REJECTED: 'Đã từ chối',
      },
    },
  },
} as const;

export default ADMIN_STRINGS;
