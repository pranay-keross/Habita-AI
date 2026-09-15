import { getCurrentLanguage, t } from '../../i18n';
import { formatDateLabel, formatDateRangeLabel } from '../../utils/date';
import type { ClothingCategory, ClothingSeason, EventType, Mood } from './types';

// Localized labels for every wardrobe enum — screens must never render the raw wire value.

export function eventTypeLabel(type: EventType | string): string {
  return t(`style_pantry.event_${type}`);
}

export function categoryLabel(category: ClothingCategory | string): string {
  return t(`style_pantry.cat_${category}`);
}

export function seasonLabel(season: ClothingSeason | string): string {
  return t(`style_pantry.season_${season.replace('-', '_')}`);
}

export function moodLabel(mood: Mood | string): string {
  return t(`style_pantry.mood_${mood}`);
}

const LANG_TO_LOCALE: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  es: 'es-ES',
  ar: 'ar-EG',
};

export function currentLocale(): string {
  return LANG_TO_LOCALE[getCurrentLanguage()] ?? 'en-IN';
}

export function dateLabel(date: string | undefined | null): string {
  return formatDateLabel(date, currentLocale());
}

export function dateRangeLabel(start: string, end: string): string {
  return formatDateRangeLabel(start, end, currentLocale());
}

// Purchase prices have no currency on the server; INR is the product's home market.
export function priceLabel(amount: number | undefined | null, currency = 'INR'): string {
  if (amount === undefined || amount === null) return '';
  try {
    return new Intl.NumberFormat(currentLocale(), { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}
