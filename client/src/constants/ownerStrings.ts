/**
 * Constants định nghĩa toàn bộ nhãn chuỗi UI cho Owner Module
 * Tuân thủ web-coding-rules.md: không hardcode chuỗi trực tiếp trong JSX
 */

export const OWNER_STRINGS = {
  HEADER: {
    TITLE: 'KPI & Performance Hub',
    SUBTITLE: 'Performance metrics & net revenue',
  },
  PROFILE: {
    DEFAULT_USERNAME: 'Owner',
    DEFAULT_EMAIL: '',
    RATING_FALLBACK: '0.0 (0)',
    TRUST_FALLBACK: 'Trust: 0',
    TOP_OWNER_BADGE: 'Top Owner',
  },
  TIMEFRAME: {
    SECTION_TITLE: 'Performance & Revenue',
    WEEK: 'Week',
    MONTH: 'Month',
  },
  METRICS: {
    NET_REVENUE: 'Net Revenue',
    TOTAL_RENTALS: 'Total Rentals',
    ACTIVE_RENTALS: 'Active Rentals',
    OCCUPANCY_RATE: 'Occupancy Rate',
    DEFAULT_NET_REVENUE: '0 đ',
    DEFAULT_TOTAL_RENTALS: '0 orders',
    DEFAULT_ACTIVE_RENTALS: '0 devices',
    DEFAULT_OCCUPANCY_RATE: '0%',
  },
  CHART: {
    TITLE: 'Revenue last 7 days (VND)',
    PEAK_PREFIX: 'Peak: 0 đ',
  },
  WALLET: {
    AVAILABLE_BALANCE: 'Available Balance',
    WITHDRAW: 'Withdraw',
    ESCROW_HOLDING: 'Escrow Holding',
    MONTHLY_REVENUE: 'Monthly Revenue',
    DEFAULT_AVAILABLE: '0 đ',
    DEFAULT_ESCROW: '0 đ',
    DEFAULT_MONTHLY: '0 đ',
    DEFAULT_TREND: '',
  },
  SIDEBAR: {
    MENU_SECTION: 'OWNER MENU',
    DASHBOARD_KPIS: 'Dashboard & KPIs',
    REVENUE_ANALYTICS: 'Revenue & Analytics',
    PENDING_BOOKINGS: 'Pending Bookings',
    CUSTOMER_MESSAGES: 'Customer Messages',
    MY_DEVICE_INVENTORY: 'My Device Inventory',
    LIST_NEW_DEVICES: 'List New Devices',
    REVENUE_DEPOSIT_WALLET: 'Revenue & Deposit Wallet',
    AI_ASSISTANT: 'AI Assistant',
    SWITCH_TO_RENTER_MODE: 'Switch to Renter Mode',
    SYSTEM_NOTIFICATIONS: 'System Notifications',
    SIGN_OUT: 'Sign Out of Owner Session',
  },
  MESSAGES: {
    HEADER_TITLE: 'Customer Messages',
    HEADER_SUBTITLE: 'Direct chats with renters for active & pending bookings',
    SEARCH_PLACEHOLDER: 'Search renter or device...',
    TABS: {
      ALL_CHATS: 'All Chats',
      RENTING: 'Renting',
      PENDING: 'Pending',
      COMPLETED: 'Completed',
    },
    EMPTY_SEARCH: 'Không tìm thấy cuộc trò chuyện nào phù hợp',
    EMPTY_LIST: 'Chưa có cuộc trò chuyện nào',
    FALLBACK_SNIPPET: 'Chưa có tin nhắn',
    OTHER_BOOKINGS: 'đơn khác',
    SWITCH_BOOKING: 'Đổi đơn',
    SWITCH_BOOKING_TITLE: 'Chọn đơn thuê cần trao đổi',
    CLOSE: 'Đóng',
    ACTIVE_BOOKING_BADGE: 'Đang xem',
    CANNOT_CHAT_WITH_SELF: 'Bạn không thể nhắn tin với chính mình.',
    START_CONVERSATION_TITLE: 'Bắt đầu cuộc trò chuyện',
    START_CONVERSATION_SUBTITLE: 'Gửi tin nhắn hoặc chọn mẫu tin nhắn nhanh bên dưới để trao đổi với',
    PARTNER: 'đối tác',
  },
} as const;
