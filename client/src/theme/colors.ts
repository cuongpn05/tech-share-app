/**
 * Bảng màu chính thức cho TechShare (tuân thủ 100% theme-skill.md)
 * Theme: Soft Teal/Cyan & Slate (Light mode mặc định)
 */

export const colors = {
  light: {
    // Brand Colors (Soft Teal/Cyan)
    primary: '#67BEC3',        // brand-500: Core Brand Color
    primaryHover: '#4CA6AC',   // brand-600: Hover state của nút bấm
    primaryDark: '#286E74',    // brand-800: Text nhấn mạnh, text giá tiền
    primaryLight: '#E8F6F7',   // brand-100: Nền cho icon wrapper, active tab pill
    primaryBg: '#F0FAF9',      // brand-50: Background siêu nhạt
    primaryRgb: '103, 190, 195', // brand-500 RGB channel for charts & opacities

    // Neutrals & Surfaces
    background: '#F8FAFC',     // Slate-50: Nền tổng thể
    surface: '#FFFFFF',        // White: Nền thẻ, card, modal
    card: '#FFFFFF',           // Alias cho surface
    border: '#F1F5F9',         // Slate-100: Viền siêu mảnh (No Boxy Layouts)
    borderSubtle: '#F1F5F9',   // Slate-100
    borderDefault: '#E2E8F0',  // Slate-200: Viền ngăn cách nhẹ
    textPrimary: '#0F172A',    // Slate-900: Tiêu đề chính
    textSecondary: '#64748B',  // Slate-500: Mô tả phụ, nhãn
    textMuted: '#94A3B8',      // Slate-400: Chữ mờ, icon inactive
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#0F172A',

    // Semantic Colors
    success: '#10B981',        // Green: Tăng trưởng, hoàn tất
    successLight: '#ECFDF5',   // Green-50: Nền badge hoàn tất/uy tín
    warning: '#F59E0B',        // Amber: Cảnh báo, ký quỹ
    warningLight: '#FEF3C7',   // Amber-50: Nền badge rating/cảnh báo
    error: '#EF4444',          // Red: Lỗi, hủy, đăng xuất
    danger: '#EF4444',         // Alias cho error
    dangerLight: '#FEE2E2',    // Red-50: Nền nút đăng xuất/xóa
    ratingStar: '#F59E0B',

    // Google Gemini AI
    ai: '#6366F1',             // Indigo: AI Assistant Hub
    aiLight: '#EEF2FF',        // Indigo-50: Nền icon AI
  },
  dark: {
    primary: '#67BEC3',
    primaryHover: '#4CA6AC',
    primaryDark: '#388E94',
    primaryLight: '#1E3A5F',
    primaryBg: '#0F262B',
    background: '#0B1220',
    surface: '#151E2E',
    card: '#151E2E',
    border: '#1F2A3D',
    borderSubtle: '#1F2A3D',
    borderDefault: '#334155',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    white: '#FFFFFF',
    success: '#10B981',
    successLight: '#064E3B',
    warning: '#F59E0B',
    warningLight: '#78350F',
    error: '#EF4444',
    danger: '#EF4444',
    dangerLight: '#7F1D1D',
    ratingStar: '#F59E0B',
    ai: '#6366F1',
    aiLight: '#312E81',
  },
};

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = typeof colors.light;
