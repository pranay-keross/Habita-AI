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
  blush: string;
  forest: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  danger: string;
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
    name: 'Terracotta',
    description: 'Warm earthy · default',
    swatch: ['#BC4B51', '#F7D6D0'],
    isDark: false,
    shadowColor: '#BC4B51',
    colors: {
      primary: '#C96B5D',
      primaryDark: '#A5564A',
      deepMaroon: '#7D3F3F',
      background: '#FCF7F2',
      surface: '#F8EFE8',
      surfaceElevated: '#FFFDF9',
      turmeric: '#D9A24C',
      blush: '#F4DCD3',
      forest: '#5B7B5C',
      textPrimary: '#4A2F2B',
      textSecondary: '#6A514C',
      textMuted: '#8C726D',
      border: 'rgba(201, 107, 93, 0.16)',
      borderStrong: 'rgba(201, 107, 93, 0.34)',
      danger: '#C95A4C',
    },
  },
  {
    key: 'ocean',
    name: 'Ocean Breeze',
    description: 'Cool · calming blues',
    swatch: ['#0A6E8C', '#C5E8EF'],
    isDark: false,
    shadowColor: '#0A6E8C',
    colors: {
      primary: '#0A6E8C',
      primaryDark: '#075A72',
      deepMaroon: '#044253',
      background: '#F3F9FB',
      surface: '#E6F1F4',
      surfaceElevated: '#FFFFFF',
      turmeric: '#F2A65A',
      blush: '#C5E8EF',
      forest: '#1A8F73',
      textPrimary: '#0C2A34',
      textSecondary: '#2B4852',
      textMuted: '#6A8490',
      border: 'rgba(10, 110, 140, 0.15)',
      borderStrong: 'rgba(10, 110, 140, 0.35)',
      danger: '#C0392B',
    },
  },
  {
    key: 'midnight',
    name: 'Midnight',
    description: 'Dark · easy on the eyes',
    swatch: ['#8B5CF6', '#1F1B2E'],
    isDark: true,
    shadowColor: '#000',
    colors: {
      primary: '#A78BFA',
      primaryDark: '#8B5CF6',
      deepMaroon: '#F0ABFC',
      background: '#14121D',
      surface: '#1F1B2E',
      surfaceElevated: '#2A2440',
      turmeric: '#F5B840',
      blush: '#3A2F52',
      forest: '#4ADE80',
      textPrimary: '#F3F0FF',
      textSecondary: '#D0C8E8',
      textMuted: '#9187A8',
      border: 'rgba(167, 139, 250, 0.20)',
      borderStrong: 'rgba(167, 139, 250, 0.45)',
      danger: '#F87171',
    },
  },
];

export const colors: PaletteColors = { ...palettes[0].colors };
export const currentPaletteMeta = { key: palettes[0].key, isDark: palettes[0].isDark };

export function applyPalette(paletteKey: string) {
  const p = palettes.find((x) => x.key === paletteKey) || palettes[0];
  Object.assign(colors, p.colors);
  currentPaletteMeta.key = p.key;
  currentPaletteMeta.isDark = p.isDark;
}

const THEME_KEY = 'saheli.theme.palette';

export async function loadSavedTheme(): Promise<string> {
  const saved = await getItem<string>(THEME_KEY, 'terracotta');
  const key = palettes.find((p) => p.key === saved) ? saved : 'terracotta';
  applyPalette(key);
  return key;
}

export async function saveTheme(paletteKey: string) {
  applyPalette(paletteKey);
  await setItem(THEME_KEY, paletteKey);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifRegular: 'Fraunces_400Regular',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
};

export const shadow = Platform.OS === 'web'
  ? {
      soft: { boxShadow: '0 4px 16px rgba(201,107,93,0.08)' } as any,
      medium: { boxShadow: '0 6px 20px rgba(125,63,63,0.12)' } as any,
    }
  : {
      soft: {
        shadowColor: '#C96B5D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
      },
      medium: {
        shadowColor: '#7D3F3F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 6,
      },
    };

export const theme = {
  colors,
  spacing,
  radius,
  fonts,
  shadow,
};
