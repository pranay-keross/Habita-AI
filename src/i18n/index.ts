import { I18n } from 'i18n-js';
import { I18nManager } from 'react-native';
import { getItem, setItem } from '../utils/storage';
import en from './locales/en.json';
import bn from './locales/bn.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import es from './locales/es.json';
import ar from './locales/ar.json';

const listeners = new Set<() => void>();
let currentLocale = 'en';

export const SUPPORTED_LANGS = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'Arabic', native: 'العربية', flag: '🇸🇦' },
];

export const RTL_LANGS = ['ar'];

export const i18n = new I18n({ en, bn, hi, ta, es, ar });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = 'en';

const LANG_KEY = 'habita.lang';

export const t = (key: string, options?: Record<string, any>) => i18n.t(key, options);

export function subscribeToLanguageChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentLanguage() {
  return currentLocale;
}

export async function loadSavedLanguage(): Promise<string> {
  const saved = await getItem<string>(LANG_KEY, 'en');
  const code = SUPPORTED_LANGS.find((l) => l.code === saved) ? saved : 'en';
  applyLanguage(code);
  return code;
}

export async function setLanguage(code: string) {
  await setItem(LANG_KEY, code);
  applyLanguage(code);
}

function applyLanguage(code: string) {
  const changed = code !== currentLocale;
  currentLocale = code;
  i18n.locale = code;
  try {
    // Keep standard LTR layout structure so navigation headers, back buttons, and flex directions stay left-aligned
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  } catch {}
  // Screens that key off `subscribeToLanguageChanges` (dashboard.tsx, FamilyScreen.tsx)
  // remount their whole tree via a `key={localeVersion}` bump on every notification.
  // Background callers re-apply `preferredLanguage` from a profile fetch on every
  // screen focus, which is usually already the active language — without this guard
  // that fired a full remount (a visible blink) after every silent fetch even though
  // nothing changed.
  if (changed) {
    listeners.forEach((listener) => listener());
  }
}

