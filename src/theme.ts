import { Platform } from 'react-native';
import { getItem, setItem } from './utils/storage';

export interface PaletteColors {
  primary: string;
  primaryDark: string;
  deepMaroon: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  turmeric: string;
  turmericSoft: string;
  blush: string;
  forest: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  textOnPrimaryMuted: string;
  textOnPrimaryAccent: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  accentCyan: string;
  accentIndigo: string;
  glassSurface: string;
  glassBorder: string;
  cardGlow: string;
  navBackground: string;
  navBorder: string;
  navActivePill: string;
  navActiveText: string;
  chartLine: string;
  chartGradientStart: string;
  chartGradientEnd: string;
}

export interface Palette {
  key: string;
  name: string;
  description: string;
  swatch: [string, string];
  colors: PaletteColors;
  shadowColor: string;
  isDark: boolean;
}

export const palettes: Palette[] = [
  {
    key: 'terracotta',
    name: 'CRED Minimalist',
    description: 'Clean White Canvas · Jet Black & Thin Typography',
    swatch: ['#000000', '#FFFFFF'],
    isDark: false,
    shadowColor: '#000000',
    colors: {
      primary: '#000000',
      primaryDark: '#222222',
      deepMaroon: '#FF2E93',
      background: '#F8F9FA',
      surface: '#FFFFFF',
      surfaceElevated: '#F2F3F5',
      turmeric: '#F59E0B',
      turmericSoft: 'rgba(245, 158, 11, 0.12)',
      blush: 'rgba(0, 0, 0, 0.05)',
      forest: '#10B981',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textMuted: '#999999',
      textOnPrimary: '#FFFFFF',
      textOnPrimaryMuted: '#E0E0E0',
      textOnPrimaryAccent: '#FFFFFF',
      border: '#ECECEE',
      borderStrong: '#D1D1D6',
      danger: '#FF3B30',
      dangerSoft: 'rgba(255, 59, 48, 0.10)',
      dangerBorder: '#FF3B30',
      accentCyan: '#0070F3',
      accentIndigo: '#6A35FF',
      glassSurface: '#FFFFFF',
      glassBorder: '#ECECEE',
      cardGlow: 'rgba(0, 0, 0, 0.04)',
      navBackground: '#0D0D0D',
      navBorder: '#222222',
      navActivePill: '#FFFFFF',
      navActiveText: '#FFFFFF',
      chartLine: '#000000',
      chartGradientStart: 'rgba(0, 0, 0, 0.08)',
      chartGradientEnd: 'rgba(0, 0, 0, 0.00)',
    },
  },
  {
    key: 'ocean',
    name: 'Cyber Cyan',
    description: 'CRED Electric Blue & White',
    swatch: ['#00D2FF', '#FFFFFF'],
    isDark: false,
    shadowColor: '#00D2FF',
    colors: {
      primary: '#0070F3',
      primaryDark: '#0051B3',
      deepMaroon: '#F43F5E',
      background: '#F4F7FB',
      surface: '#FFFFFF',
      surfaceElevated: '#EAF1F8',
      turmeric: '#F59E0B',
      turmericSoft: 'rgba(245, 158, 11, 0.12)',
      blush: 'rgba(0, 112, 243, 0.08)',
      forest: '#10B981',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      textOnPrimary: '#FFFFFF',
      textOnPrimaryMuted: '#E0E7FF',
      textOnPrimaryAccent: '#FFFFFF',
      border: '#E2E8F0',
      borderStrong: '#CBD5E1',
      danger: '#FF3B30',
      dangerSoft: 'rgba(255, 59, 48, 0.10)',
      dangerBorder: '#FF3B30',
      accentCyan: '#0070F3',
      accentIndigo: '#6A35FF',
      glassSurface: '#FFFFFF',
      glassBorder: '#E2E8F0',
      cardGlow: 'rgba(0, 112, 243, 0.05)',
      navBackground: '#0D0D0D',
      navBorder: '#222222',
      navActivePill: '#FFFFFF',
      navActiveText: '#FFFFFF',
      chartLine: '#0070F3',
      chartGradientStart: 'rgba(0, 112, 243, 0.10)',
      chartGradientEnd: 'rgba(0, 112, 243, 0.00)',
    },
  },
  {
    key: 'midnight',
    name: 'Poli Purple',
    description: 'CRED Luxury Ultraviolet & Jet Black',
    swatch: ['#6A35FF', '#0E0B16'],
    isDark: true,
    shadowColor: '#6A35FF',
    colors: {
      primary: '#6A35FF',
      primaryDark: '#5322DB',
      deepMaroon: '#EC4899',
      background: '#0E0B16',
      surface: '#171422',
      surfaceElevated: '#211D30',
      turmeric: '#FFB800',
      turmericSoft: 'rgba(255, 184, 0, 0.15)',
      blush: 'rgba(106, 53, 255, 0.15)',
      forest: '#00E599',
      textPrimary: '#F8F9FA',
      textSecondary: '#A5A2B8',
      textMuted: '#6D697C',
      textOnPrimary: '#FFFFFF',
      textOnPrimaryMuted: '#211D30',
      textOnPrimaryAccent: '#EDE9FE',
      border: '#28233A',
      borderStrong: '#3D3558',
      danger: '#FF3B30',
      dangerSoft: 'rgba(255, 59, 48, 0.15)',
      dangerBorder: '#FF3B30',
      accentCyan: '#00D2FF',
      accentIndigo: '#6A35FF',
      glassSurface: '#171422',
      glassBorder: '#28233A',
      cardGlow: 'rgba(106, 53, 255, 0.18)',
      navBackground: '#0D0D0D',
      navBorder: '#222222',
      navActivePill: '#6A35FF',
      navActiveText: '#FFFFFF',
      chartLine: '#6A35FF',
      chartGradientStart: 'rgba(106, 53, 255, 0.40)',
      chartGradientEnd: 'rgba(106, 53, 255, 0.01)',
    },
  },
];

export const colors: PaletteColors = { ...palettes[0].colors };
export const currentPaletteMeta = { key: palettes[0].key, isDark: palettes[0].isDark };

type ThemeListener = () => void;
const listeners = new Set<ThemeListener>();

export function subscribeToThemeChanges(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyPalette(key: string): void {
  const p = palettes.find((item) => item.key === key);
  if (!p) return;
  Object.assign(colors, p.colors);
  currentPaletteMeta.key = p.key;
  currentPaletteMeta.isDark = p.isDark;
  shadow.soft = makeShadow(p.shadowColor, 6, 0.06, 1, 2);
  shadow.medium = makeShadow(p.shadowColor, 12, 0.10, 2, 4);
  listeners.forEach((l) => l());
}

export const THEME_STORAGE_KEY = 'habita.theme.palette';

export async function loadSavedTheme(): Promise<string> {
  const saved = await getItem<string>(THEME_STORAGE_KEY, palettes[0].key);
  if (saved && palettes.some((p) => p.key === saved)) {
    applyPalette(saved);
    return saved;
  }
  return palettes[0].key;
}

export async function saveTheme(key: string): Promise<void> {
  if (palettes.some((p) => p.key === key)) {
    applyPalette(key);
    await setItem(THEME_STORAGE_KEY, key);
  }
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  card: 16,
  xxl: 24,
  xxxl: 36,
  full: 9999,
  pill: 9999,
};

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  serifRegular: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  sansMedium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'sans-serif-medium' }),
  sansBold: Platform.select({ ios: 'System', android: 'Roboto-Bold', default: 'sans-serif' }),
};

function makeShadow(
  color: string,
  blur: number,
  opacity: number,
  offsetY: number,
  elevation: number
) {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetY}px ${blur}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

export const shadow = {
  soft: makeShadow(palettes[0].shadowColor, 6, 0.05, 1, 2),
  medium: makeShadow(palettes[0].shadowColor, 12, 0.08, 2, 4),
};

export interface ThemeTokens {
  colors: PaletteColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  shadow: typeof shadow;
}

export const theme: ThemeTokens = {
  colors,
  spacing,
  radius,
  fonts,
  shadow,
};

export default theme;
