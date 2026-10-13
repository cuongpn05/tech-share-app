/**
 * Design Tokens chuẩn cho TechShare Mobile App
 * Tuân thủ theme-skill.md và web-coding-rules.md
 */

export const colors = {
  // Brand Primary (Soft Teal)
  brand: {
    50: '#F0FDFA',
    100: '#E6F7F7',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#0D9488',
    600: '#0F766E',
    700: '#115E59',
    800: '#134E4A',
    900: '#042F2E',
  },

  // Surfaces & Backgrounds
  background: '#F8FAFC', // Slate-50
  surface: '#FFFFFF',    // Pure White
  surfaceMuted: '#F1F5F9', // Slate-100

  // Text Colors
  text: {
    primary: '#0F172A',   // Slate-900 (Đậm sắc nét)
    secondary: '#475569', // Slate-600
    muted: '#64748B',     // Slate-500
    subtle: '#94A3B8',    // Slate-400
    inverse: '#FFFFFF',
  },

  // Semantic Accents
  blue: '#2563EB',
  blueLight: '#EBF5FF',
  green: '#10B981',
  greenLight: '#E6FBF5',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  purple: '#6366F1',
  purpleLight: '#EEF2FF',
  red: '#DC2626',
  redLight: '#FEF2F2',
  redBorder: '#FCA5A5',

  // Category Accents
  categories: {
    cameras: '#6366F1',
    laptops: '#14B8A6',
    smartphones: '#10B981',
    gaming: '#D97706',
  },

  // Borders
  border: {
    light: '#E2E8F0',
    default: '#CBD5E1',
    divider: '#F1F5F9',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  floatButton: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 15,
    lg: 18,
    xl: 20,
    '2xl': 22,
    '3xl': 26,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
} as const;

export type Theme = typeof theme;
export default theme;
