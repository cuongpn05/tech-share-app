/**
 * TechShare Design System Tokens
 * Tuân thủ 100% tài liệu quy chuẩn giao diện theme-skill.md & Quy chuẩn chống hardcode
 * Sử dụng nguồn màu duy nhất từ theme/colors.ts
 */

import { colors } from '../theme/colors';

const palette = colors.light;

export const theme = {
  colors: {
    // Brand Colors (Soft Teal/Cyan) - theme-skill.md
    primary: {
      50: palette.primaryBg,      // Background siêu nhạt, nền hover/active nhẹ
      100: palette.primaryLight,  // Nền cho icon wrapper, active tab pill
      200: '#D0EFF1',
      300: '#A4DEE2',
      500: palette.primary,       // Core Brand Color (#67BEC3)
      600: palette.primaryHover,  // Hover state của nút bấm (#4CA6AC)
      700: '#388E94',
      800: palette.primaryDark,   // Text nhấn mạnh, text giá tiền (#286E74)
    },
    // Alias brand -> primary
    brand: {
      50: palette.primaryBg,
      100: palette.primaryLight,
      200: '#D0EFF1',
      300: '#A4DEE2',
      500: palette.primary,
      600: palette.primaryHover,
      700: '#388E94',
      800: palette.primaryDark,
    },
    success: {
      50: palette.successLight,
      500: palette.success,
      600: '#059669',
    },
    warning: {
      50: palette.warningLight,
      500: palette.warning,
      600: '#D97706',
    },
    danger: {
      50: palette.dangerLight,
      500: palette.danger,
      600: '#DC2626',
    },
    indigo: {
      50: palette.aiLight,
      500: palette.ai,
      600: '#4F46E5',
    },
    ai: {
      50: palette.aiLight,
      500: palette.ai,
      600: '#4F46E5',
    },
    slate: {
      50: palette.background,
      100: palette.borderSubtle,
      200: palette.borderDefault,
      400: palette.textMuted,
      500: palette.textSecondary,
      600: '#475569',
      800: '#1E293B',
      900: palette.textPrimary,
    },
    white: palette.white,
    black: palette.black,
    shadow: palette.shadow,
    overlay: 'rgba(15, 23, 42, 0.55)',
    backdrop: 'rgba(15, 23, 42, 0.45)',
    transparent: 'transparent',

    // Flat semantic tokens on colors
    primaryDefault: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primaryLight,
    primaryBg: palette.primaryBg,
    background: palette.background,
    surface: palette.surface,
    card: palette.card,
    border: palette.borderSubtle,
    borderSubtle: palette.borderSubtle,
    borderDefault: palette.borderDefault,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    textMuted: palette.textMuted,
    successLight: palette.successLight,
    warningLight: palette.warningLight,
    dangerLight: palette.dangerLight,
    aiLight: palette.aiLight,
    primaryRgb: palette.primaryRgb,
  },

  // Surfaces & Text (Light Mode mặc định) - theme-skill.md
  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primaryLight: palette.primaryLight,
  primaryBg: palette.primaryBg,
  primaryRgb: palette.primaryRgb,
  background: palette.background,       // Slate-50: Nền tổng thể
  card: palette.card,                   // White: Thẻ, card, modal
  surface: palette.surface,
  border: palette.borderSubtle,         // Slate-100: Viền siêu mảnh
  borderSubtle: palette.borderSubtle,   // Slate-100
  borderDefault: palette.borderDefault, // Slate-200
  textPrimary: palette.textPrimary,     // Slate-900: Tiêu đề chính
  textSecondary: palette.textSecondary, // Slate-500: Mô tả phụ
  textMuted: palette.textMuted,         // Slate-400: Chữ mờ, icon inactive
  white: palette.white,
  black: palette.black,
  shadow: palette.shadow,
  overlay: 'rgba(15, 23, 42, 0.55)',
  backdrop: 'rgba(15, 23, 42, 0.45)',
  transparent: 'transparent',
  success: palette.success,
  successLight: palette.successLight,
  warning: palette.warning,
  warningLight: palette.warningLight,
  danger: palette.danger,
  dangerLight: palette.dangerLight,
  ai: palette.ai,
  aiLight: palette.aiLight,

  // 8-Point Grid Spacing - theme-skill.md
  spacing: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,        // Padding/Margin tiêu chuẩn
    lg: 24,        // Khoảng cách giữa các Section
    xl: 32,
    '2xl': 48,
    // Aliases
    base: 14,
    '3xl': 32,
    '4xl': 48,
  },

  // Border Radii - theme-skill.md
  radii: {
    none: 0,
    xs: 4,
    sm: 6,         // Checkbox, badge nhỏ
    md: 12,        // Thumbnail ảnh thiết bị, input fields
    base: 12,
    lg: 16,        // Thẻ Card, Modal, Container chính
    xl: 24,        // Hero banners
    full: 9999,    // Capsule/Pill buttons, Tabs active, Avatars, Icon wrappers
  },

  // Shadows đa nền tảng - theme-skill.md
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
  },

  // Typography Scale - theme-skill.md
  typography: {
    sizes: {
      xs: 9,
      sm: 10,
      caption: 11,
      bodySm: 12,
      body: 13,
      base: 14,
      subheading: 15,
      title: 16,
      h3: 17,
      h2: 18,
      kpi: 22,
      h1: 24,
      hero: 28,
    },
    weights: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    },
    heading: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: palette.textPrimary,
    },
    subheading: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: palette.textPrimary,
    },
    kpi: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: palette.textPrimary,
    },
    body: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: palette.textPrimary,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: palette.textSecondary,
    },
    badge: {
      fontSize: 11,
      fontWeight: '700' as const,
    },
  },
};

export type ThemeTokens = typeof theme;
