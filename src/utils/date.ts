// Calendar-date helpers that stay in the device's local timezone.
// `Date#toISOString()` is UTC, so slicing it to YYYY-MM-DD shifts "today" by a day
// for part of every evening in IST — never use it for calendar dates.

export type DateString = string; // YYYY-MM-DD

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateString(d: Date): DateString {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(): DateString {
  return toDateString(new Date());
}

/** Parses YYYY-MM-DD as local midnight (not UTC, unlike `new Date('YYYY-MM-DD')`). */
export function parseDateString(value: DateString): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidDateString(value: string | undefined | null): value is DateString {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDateString(value);
  return toDateString(d) === value;
}

export function addDays(value: DateString, days: number): DateString {
  const d = parseDateString(value);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Inclusive list of dates from `start` to `end`; empty when `end < start`. */
export function dateRange(start: DateString, end: DateString): DateString[] {
  const out: DateString[] = [];
  if (end < start) return out;
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Locale-aware "15 Sep 2026" style label. */
export function formatDateLabel(
  value: DateString | undefined | null,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!isValidDateString(value)) return value ?? '';
  return parseDateString(value).toLocaleDateString(locale, options);
}

export function formatDateRangeLabel(start: DateString, end: DateString, locale?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start === end) return formatDateLabel(start, locale);
  return `${formatDateLabel(start, locale, opts)} – ${formatDateLabel(end, locale)}`;
}

/** "10:30 AM" from a Date, in the device locale. */
export function formatTimeLabel(d: Date, locale?: string): string {
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}
