import { getItem, setItem } from '../../utils/storage';
import {
  DEFAULT_CYCLE_SETTINGS,
  MAX_CYCLE_LENGTH,
  MIN_CYCLE_LENGTH,
  type CyclePhase,
  type CyclePrediction,
  type CycleReminder,
  type CycleSettings,
  type ISODate,
  type PeriodCycle,
} from './types';

export const CYCLE_STORAGE_KEY = 'habita.cycle_log';
export const CYCLE_SETTINGS_STORAGE_KEY = 'habita.cycle_settings';

const DAY_MS = 24 * 60 * 60 * 1000;

// How many recent gaps feed the average. Six is roughly half a year — long enough to
// smooth out one odd month, short enough that a genuinely changing cycle (which is
// the whole point of the perimenopause stage) is reflected instead of averaged away.
const AVERAGE_WINDOW = 6;

// ---------------------------------------------------------------------------
// Date helpers — local-calendar `YYYY-MM-DD`, no timezone maths
// ---------------------------------------------------------------------------

/**
 * `Date` is only ever used as a calendar here, never as an instant: everything is
 * normalised to local midnight first. Doing the arithmetic on raw epoch values is
 * what makes cycle apps drift by a day across a DST boundary.
 */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(now: number = Date.now()): ISODate {
  return toISODate(new Date(now));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY_MS);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  // Round-trips only if the calendar accepted it — rejects 2026-02-31 and friends.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function loadCycles(): Promise<PeriodCycle[]> {
  return getItem<PeriodCycle[]>(CYCLE_STORAGE_KEY, []);
}

export async function saveCycles(cycles: PeriodCycle[]): Promise<void> {
  await setItem(CYCLE_STORAGE_KEY, cycles);
}

export async function loadCycleSettings(): Promise<CycleSettings> {
  const stored = await getItem<CycleSettings>(CYCLE_SETTINGS_STORAGE_KEY, DEFAULT_CYCLE_SETTINGS);
  // Merge rather than trust: a settings object written by an older build is missing
  // whatever fields were added since, and `getItem` only falls back when the key is
  // absent entirely.
  return { ...DEFAULT_CYCLE_SETTINGS, ...stored };
}

export async function saveCycleSettings(settings: CycleSettings): Promise<void> {
  await setItem(CYCLE_SETTINGS_STORAGE_KEY, settings);
}

// ---------------------------------------------------------------------------
// Derivations — all pure, all unit-tested in __tests__/cyclePrediction.test.ts
// ---------------------------------------------------------------------------

/** Oldest first — the order every derivation below assumes. */
export function sortCycles(cycles: PeriodCycle[]): PeriodCycle[] {
  return [...cycles].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

/** Gaps between consecutive period starts, implausible ones dropped. */
export function cycleGaps(cycles: PeriodCycle[]): number[] {
  const sorted = sortCycles(cycles);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
    if (gap >= MIN_CYCLE_LENGTH && gap <= MAX_CYCLE_LENGTH) {
      gaps.push(gap);
    }
  }
  return gaps;
}

export function averageCycleLength(cycles: PeriodCycle[], fallback: number): number {
  const gaps = cycleGaps(cycles).slice(-AVERAGE_WINDOW);
  if (gaps.length === 0) {
    return fallback;
  }
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

/** Mean logged period length, from cycles that have an end date. */
export function averagePeriodLength(cycles: PeriodCycle[], fallback: number): number {
  const lengths = cycles
    .filter((c) => c.endDate !== null)
    .map((c) => daysBetween(c.startDate, c.endDate as ISODate) + 1)
    .filter((n) => n >= 1 && n <= 14);
  if (lengths.length === 0) {
    return fallback;
  }
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

function phaseFor(
  dayOfCycle: number,
  periodLength: number,
  today: ISODate,
  ovulationDate: ISODate,
): CyclePhase {
  if (dayOfCycle <= periodLength) {
    return 'menstrual';
  }
  const toOvulation = daysBetween(today, ovulationDate);
  if (Math.abs(toOvulation) <= 1) {
    return 'ovulation';
  }
  return toOvulation > 0 ? 'follicular' : 'luteal';
}

function confidenceFor(samples: number, settings: CycleSettings): CyclePrediction['confidence'] {
  // Perimenopause is defined by cycles becoming irregular, so the same sample count
  // that would be "high" while cycling is only ever "medium" here — presenting a
  // confident date to someone whose cycle is genuinely changing is the wrong answer.
  const cap = settings.lifeStage === 'perimenopause' ? 'medium' : 'high';
  if (samples === 0) {
    return 'low';
  }
  if (samples < 3) {
    return 'medium';
  }
  return cap;
}

/**
 * Next-cycle prediction from logged history.
 *
 * Returns `null` when a prediction would be meaningless rather than inventing one:
 * with nothing logged, or in the `menopause` stage where there is no next cycle to
 * predict. The screen renders guidance and an empty state in that case.
 *
 * The ovulation model is the standard luteal-phase-is-fixed one (ovulation ≈ 14 days
 * before the next period, fertile window the five days before it plus the day after).
 * It is an estimate, not a contraceptive method, and the UI says so.
 */
export function predictNextCycle(
  cycles: PeriodCycle[],
  settings: CycleSettings,
  today: ISODate = todayISO(),
): CyclePrediction | null {
  if (cycles.length === 0 || settings.lifeStage === 'menopause') {
    return null;
  }

  const sorted = sortCycles(cycles);
  const last = sorted[sorted.length - 1];
  const gaps = cycleGaps(cycles).slice(-AVERAGE_WINDOW);
  const cycleLength = averageCycleLength(cycles, settings.averageCycleLength);
  const periodLength = averagePeriodLength(cycles, settings.averagePeriodLength);

  const nextStart = addDays(last.startDate, cycleLength);
  const ovulationDate = addDays(nextStart, -14);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);

  const dayOfCycle = daysBetween(last.startDate, today) + 1;

  return {
    nextStart,
    ovulationDate,
    fertileStart,
    fertileEnd,
    phase: phaseFor(dayOfCycle, periodLength, today, ovulationDate),
    dayOfCycle,
    daysUntilNextStart: daysBetween(today, nextStart),
    averageCycleLength: cycleLength,
    averagePeriodLength: periodLength,
    confidence: confidenceFor(gaps.length, settings),
    samples: gaps.length,
  };
}

/**
 * What a scheduled notification *would* say, computed locally.
 *
 * Actual OS notifications need the library decision still open as `docs/BACKLOG.md`
 * M4-T4 — no library is added here (agent.md rule 7). These are rendered in-app as an
 * "upcoming" list, and are the same values a scheduler will read once M4-T4 lands, so
 * that task becomes "schedule these" rather than "work out what to schedule."
 */
export function upcomingReminders(
  cycles: PeriodCycle[],
  settings: CycleSettings,
  prediction: CyclePrediction | null,
  today: ISODate = todayISO(),
): CycleReminder[] {
  if (!settings.remindersEnabled || prediction === null) {
    return [];
  }

  const reminders: CycleReminder[] = [];
  const openCycle = sortCycles(cycles).find((c) => c.endDate === null);

  if (openCycle) {
    const daysOpen = daysBetween(openCycle.startDate, today);
    // Only nudge once the period has run past its usual length — asking on day two is
    // noise, and an unclosed cycle silently breaks `averagePeriodLength`.
    if (daysOpen >= prediction.averagePeriodLength) {
      reminders.push({
        id: `log_open_period_${openCycle.id}`,
        kind: 'log_open_period',
        date: today,
        daysAway: 0,
      });
    }
  }

  if (prediction.daysUntilNextStart < 0) {
    reminders.push({
      id: `period_late_${prediction.nextStart}`,
      kind: 'period_late',
      date: prediction.nextStart,
      daysAway: prediction.daysUntilNextStart,
    });
  } else if (prediction.daysUntilNextStart <= 3) {
    reminders.push({
      id: `period_soon_${prediction.nextStart}`,
      kind: 'period_soon',
      date: prediction.nextStart,
      daysAway: prediction.daysUntilNextStart,
    });
  }

  // The fertile-window reminder is only meaningful to someone actually planning for
  // it — showing it to every user is both noise and an assumption about their goals.
  if (settings.lifeStage === 'fertility' || settings.lifeStage === 'cycling') {
    const daysToFertile = daysBetween(today, prediction.fertileStart);
    if (daysToFertile >= 0 && daysToFertile <= 5) {
      reminders.push({
        id: `fertile_window_${prediction.fertileStart}`,
        kind: 'fertile_window',
        date: prediction.fertileStart,
        daysAway: daysToFertile,
      });
    }
  }

  return reminders.sort((a, b) => a.daysAway - b.daysAway);
}

export function createCycle(
  startDate: ISODate,
  endDate: ISODate | null,
  flow: PeriodCycle['flow'],
  symptoms: PeriodCycle['symptoms'],
  note: string,
  now: number = Date.now(),
): PeriodCycle {
  return { id: String(now), startDate, endDate, flow, symptoms, note: note.trim() };
}
