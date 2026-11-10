/**
 * TechShare Design System Tokens
 * Canonical Source of Truth for TechShare Mobile Application
 * Brand Palette: Soft Teal / Cyan (#67BEC3) & Slate Neutrals
 */

export const colors = {
  // Brand Primary (Soft Teal/Cyan) - Canonical TechShare Palette
  brand: {
    50: '#F0FAF9',   // Very light background, hover state
    100: '#E8F6F7',  // Soft accent surface, active tab pill
    200: '#D0EFF1',  // Subtle accent border
    300: '#A4DEE2',  // Secondary brand element
    400: '#84CFD3',  // Tinted brand border
    500: '#67BEC3',  // Core Brand Color (#67BEC3)
    600: '#4CA6AC',  // Brand hover / active state
    700: '#388E94',  // Medium teal accent
    800: '#286E74',  // Dark teal for accessible text contrast
    900: '#1E4E52',  // Deep teal
  },

  // Primary Color Aliases
  primary: '#67BEC3',
  primaryHover: '#4CA6AC',
  primaryDark: '#286E74',
  primaryLight: '#E8F6F7',
  primaryBg: '#F0FAF9',
  primaryRgb: '103, 190, 195',

  // Surfaces & Backgrounds
  background: '#F8FAFC',    // Slate-50: Main app background
  surface: '#FFFFFF',       // Pure White: Card, modal, sheet surfaces
  surfaceMuted: '#F1F5F9',  // Slate-100: Input background, inactive pill
  card: '#FFFFFF',          // Card surface
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.45)',
  backdrop: 'rgba(15, 23, 42, 0.55)',
  transparent: 'transparent',

  // Text Colors (Accessible Slate Neutrals)
  text: {
    primary: '#0F172A',   // Slate-900: High-contrast headings and primary text
    secondary: '#475569', // Slate-600: Secondary descriptions
    muted: '#64748B',     // Slate-500: Muted metadata, timestamps
    subtle: '#94A3B8',    // Slate-400: Inactive icons, placeholder text
    inverse: '#FFFFFF',   // White text on dark/brand backgrounds
  },

  // Semantic Status Colors
  success: '#10B981',       // Emerald green
  successLight: '#ECFDF5',  // Emerald-50
  warning: '#F59E0B',       // Amber warning
  warningLight: '#FEF3C7',  // Amber-50
  danger: '#EF4444',        // Red destructive
  dangerLight: '#FEE2E2',   // Red-50
  error: '#EF4444',         // Red error
  errorLight: '#FEE2E2',    // Red-50
  red: '#EF4444',
  redLight: '#FEE2E2',
  redBorder: '#FECACA',
  blue: '#2563EB',
  blueLight: '#EBF5FF',
  green: '#10B981',
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FEF3C7',

  // AI Assistant Accents
  ai: '#6366F1',
  aiLight: '#EEF2FF',
  purple: '#6366F1',
  purpleLight: '#EEF2FF',

  // Borders
  border: {
    light: '#F1F5F9',    // Slate-100: Ultra-light separator
    subtle: '#F1F5F9',   // Slate-100
    default: '#E2E8F0',  // Slate-200: Default card and input border
    divider: '#F1F5F9',  // List item separator
  },
  borderSubtle: '#F1F5F9',
  borderDefault: '#E2E8F0',

  // Category Accents (Minimal, brand-aligned)
  categories: {
    cameras: '#67BEC3',
    laptops: '#388E94',
    smartphones: '#10B981',
    gaming: '#F59E0B',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
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
    shadowColor: '#67BEC3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
  colors: {
    ...colors,
    primary: colors.brand,
  },
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  spacing,
  radii,
  shadows,
  typography,
} as const;

export type Theme = typeof theme;
export default theme;
