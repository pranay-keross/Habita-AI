import { getItem, setItem } from '../../utils/storage';
import type { MoodEntry, MoodFactor, MoodLevel } from './types';

export const MOOD_STORAGE_KEY = 'habita.mood_entries';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadMoodEntries(): Promise<MoodEntry[]> {
  return getItem<MoodEntry[]>(MOOD_STORAGE_KEY, []);
}

export async function saveMoodEntries(entries: MoodEntry[]): Promise<void> {
  await setItem(MOOD_STORAGE_KEY, entries);
}

/** Newest first — the order the timeline renders in, computed once here. */
export function sortByNewest(entries: MoodEntry[]): MoodEntry[] {
  return [...entries].sort((a, b) => b.loggedAt - a.loggedAt);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function entriesToday(entries: MoodEntry[], now: number = Date.now()): MoodEntry[] {
  const from = startOfDay(now);
  return entries.filter((e) => e.loggedAt >= from && e.loggedAt <= now);
}

/**
 * Trailing 7-day mean mood, or null with nothing logged in the window.
 *
 * Null rather than 0 for the same reason `calculateAdherence` returns null: a
 * zero here would render as "worst possible week" when the truth is "no data".
 */
export function averageMood(entries: MoodEntry[], days = 7, now: number = Date.now()): number | null {
  const from = now - days * DAY_MS;
  const inWindow = entries.filter((e) => e.loggedAt >= from && e.loggedAt <= now);
  if (inWindow.length === 0) {
    return null;
  }
  const sum = inWindow.reduce((acc, e) => acc + e.level, 0);
  return Math.round((sum / inWindow.length) * 10) / 10;
}

/**
 * Consecutive days ending today (or yesterday) that have at least one entry.
 *
 * Counting from yesterday when today is empty is deliberate: a streak shouldn't
 * visibly reset at midnight and shame the user before they've had a chance to
 * check in. It only breaks once a full day has been missed.
 */
export function checkInStreak(entries: MoodEntry[], now: number = Date.now()): number {
  if (entries.length === 0) {
    return 0;
  }
  const days = new Set(entries.map((e) => startOfDay(e.loggedAt)));
  const today = startOfDay(now);
  let cursor = days.has(today) ? today : today - DAY_MS;
  if (!days.has(cursor)) {
    return 0;
  }
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/**
 * One averaged mood value per day for the last `days` days, oldest first, with
 * `null` for days that were never logged — the shape the trend bars render from.
 */
export function moodTrend(entries: MoodEntry[], days = 7, now: number = Date.now()): (number | null)[] {
  const today = startOfDay(now);
  const buckets: number[][] = Array.from({ length: days }, () => []);
  entries.forEach((e) => {
    const offset = Math.round((today - startOfDay(e.loggedAt)) / DAY_MS);
    if (offset >= 0 && offset < days) {
      buckets[days - 1 - offset].push(e.level);
    }
  });
  return buckets.map((levels) =>
    levels.length === 0 ? null : Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10,
  );
}

/**
 * The factors attached to the most entries in the window, most frequent first.
 * Drives the "what's been weighing on you" summary and the coach's technique pick.
 */
export function topFactors(
  entries: MoodEntry[],
  days = 7,
  now: number = Date.now(),
): { factor: MoodFactor; count: number }[] {
  const from = now - days * DAY_MS;
  const counts = new Map<MoodFactor, number>();
  entries
    .filter((e) => e.loggedAt >= from && e.loggedAt <= now)
    .forEach((e) => e.factors.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1)));
  return [...counts.entries()]
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count);
}

export function createMoodEntry(
  level: MoodLevel,
  factors: MoodFactor[],
  note: string,
  now: number = Date.now(),
): MoodEntry {
  return { id: String(now), level, factors, note: note.trim(), loggedAt: now };
}
