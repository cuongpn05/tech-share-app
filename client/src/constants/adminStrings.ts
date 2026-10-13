/**
 * Chuỗi văn bản chuẩn cho phân hệ Quản trị Admin Hub
 * Tuân thủ web-coding-rules.md: KHÔNG HARDCODE chuỗi trong component
 */

export const ADMIN_STRINGS = {
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
      DEFAULT_VALUE: '51,330,000 VND',
      TREND: '+18.4% this month',
    },
    USERS: {
      LABEL: 'Users',
      DEFAULT_VALUE: '18 Accounts',
      SUBTITLE: '3 Verified • 11 Active',
    },
    DEVICES: {
      LABEL: 'Total Devices',
      DEFAULT_VALUE: '102 Units',
      SUBTITLE: '2 Rented • 98 Available',
    },
    ORDERS: {
      LABEL: 'Rental Orders',
      DEFAULT_VALUE: '21 Orders',
      SUBTITLE: '9 Active • 12 Completed',
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
      EMAIL: 'admin@techshare.vn',
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
} as const;

export default ADMIN_STRINGS;
