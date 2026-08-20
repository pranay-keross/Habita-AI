/**
 * Pure-function coverage for M4-T6/T8's derivations.
 *
 * `M4-T8`'s acceptance criterion names the cycle prediction specifically: "prediction
 * is a pure, unit-tested function." Nothing here renders a component or touches
 * AsyncStorage — every function under test takes its inputs (including `now`/`today`)
 * as arguments, which is the whole reason they were written that way.
 */
import {
  averageCycleLength,
  averagePeriodLength,
  addDays,
  createCycle,
  cycleGaps,
  daysBetween,
  isValidISODate,
  predictNextCycle,
  todayISO,
  upcomingReminders,
} from '../src/features/cycle/cycleStore';
import { DEFAULT_CYCLE_SETTINGS, type CycleSettings, type PeriodCycle } from '../src/features/cycle/types';
import {
  averageMood,
  checkInStreak,
  entriesToday,
  moodTrend,
  topFactors,
} from '../src/features/wellness/wellnessStore';
import type { MoodEntry, MoodLevel } from '../src/features/wellness/types';
import { LocalCbtCoach } from '../src/features/wellness/cbtCoach';

// --- helpers ---------------------------------------------------------------

const settings = (overrides: Partial<CycleSettings> = {}): CycleSettings => ({
  ...DEFAULT_CYCLE_SETTINGS,
  ...overrides,
});

const cycleOn = (startDate: string, endDate: string | null = null): PeriodCycle =>
  createCycle(startDate, endDate, 'medium', [], '', Date.parse(`${startDate}T00:00:00`));

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 7, 20, 12, 0, 0).getTime(); // 2026-08-20, local noon

const moodAt = (daysAgo: number, level: MoodLevel, factors: MoodEntry['factors'] = []): MoodEntry => ({
  id: `m${daysAgo}-${level}`,
  level,
  factors,
  note: '',
  loggedAt: NOW - daysAgo * DAY_MS,
});

// --- date helpers ----------------------------------------------------------

describe('cycle date helpers', () => {
  it('adds and subtracts days across a month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('counts days in both directions', () => {
    expect(daysBetween('2026-08-01', '2026-08-29')).toBe(28);
    expect(daysBetween('2026-08-29', '2026-08-01')).toBe(-28);
  });

  it('rejects dates the calendar would not accept', () => {
    expect(isValidISODate('2026-02-31')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('20260201')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
  });

  it('formats today from a given instant', () => {
    expect(todayISO(NOW)).toBe('2026-08-20');
  });
});

// --- averages --------------------------------------------------------------

describe('averageCycleLength', () => {
  it('falls back to the configured default with no history', () => {
    expect(averageCycleLength([], 30)).toBe(30);
    expect(averageCycleLength([cycleOn('2026-08-01')], 30)).toBe(30);
  });

  it('averages the gaps between consecutive starts', () => {
    const cycles = [cycleOn('2026-06-01'), cycleOn('2026-06-29'), cycleOn('2026-07-29')];
    // gaps: 28, 30 -> 29
    expect(cycleGaps(cycles)).toEqual([28, 30]);
    expect(averageCycleLength(cycles, 28)).toBe(29);
  });

  it('excludes an implausible gap rather than letting a typo drag the mean', () => {
    // The 2025 entry is four months out — a mis-typed year, the exact case the
    // MIN/MAX_CYCLE_LENGTH guard exists for.
    const cycles = [cycleOn('2025-06-01'), cycleOn('2026-06-01'), cycleOn('2026-06-29')];
    expect(cycleGaps(cycles)).toEqual([28]);
    expect(averageCycleLength(cycles, 35)).toBe(28);
  });

  it('is unaffected by input order', () => {
    const ordered = [cycleOn('2026-06-01'), cycleOn('2026-06-29'), cycleOn('2026-07-29')];
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(averageCycleLength(shuffled, 28)).toBe(averageCycleLength(ordered, 28));
  });

  it('averages only cycles that have an end date', () => {
    const cycles = [cycleOn('2026-06-01', '2026-06-05'), cycleOn('2026-06-29')];
    expect(averagePeriodLength(cycles, 7)).toBe(5); // inclusive of both endpoints
    expect(averagePeriodLength([cycleOn('2026-06-29')], 7)).toBe(7);
  });
});

// --- prediction ------------------------------------------------------------

describe('predictNextCycle', () => {
  it('returns null with nothing logged', () => {
    expect(predictNextCycle([], settings(), '2026-08-20')).toBeNull();
  });

  it('returns null in the menopause stage, where there is no next cycle', () => {
    expect(
      predictNextCycle([cycleOn('2026-08-01')], settings({ lifeStage: 'menopause' }), '2026-08-20'),
    ).toBeNull();
  });

  it('predicts from the configured default when only one cycle is logged', () => {
    const p = predictNextCycle([cycleOn('2026-08-01')], settings(), '2026-08-20');
    expect(p).not.toBeNull();
    expect(p!.nextStart).toBe('2026-08-29'); // 2026-08-01 + 28
    expect(p!.averageCycleLength).toBe(28);
    expect(p!.samples).toBe(0);
    expect(p!.confidence).toBe('low');
    expect(p!.dayOfCycle).toBe(20);
    expect(p!.daysUntilNextStart).toBe(9);
  });

  it('uses the logged average once there is history, and grows confident', () => {
    const cycles = [
      cycleOn('2026-05-05'),
      cycleOn('2026-06-04'),
      cycleOn('2026-07-04'),
      cycleOn('2026-08-03'),
    ];
    const p = predictNextCycle(cycles, settings(), '2026-08-20')!;
    expect(p.averageCycleLength).toBe(30);
    expect(p.nextStart).toBe('2026-09-02');
    expect(p.samples).toBe(3);
    expect(p.confidence).toBe('high');
  });

  it('never reports high confidence during perimenopause, however much history exists', () => {
    const cycles = [
      cycleOn('2026-05-05'),
      cycleOn('2026-06-04'),
      cycleOn('2026-07-04'),
      cycleOn('2026-08-03'),
    ];
    const p = predictNextCycle(cycles, settings({ lifeStage: 'perimenopause' }), '2026-08-20')!;
    expect(p.samples).toBe(3);
    expect(p.confidence).toBe('medium');
  });

  it('places ovulation 14 days before the next period, with the fertile window around it', () => {
    const p = predictNextCycle([cycleOn('2026-08-01')], settings(), '2026-08-20')!;
    expect(p.ovulationDate).toBe('2026-08-15'); // 2026-08-29 − 14
    expect(p.fertileStart).toBe('2026-08-10');
    expect(p.fertileEnd).toBe('2026-08-16');
  });

  it('reports a negative countdown once the period is late', () => {
    const p = predictNextCycle([cycleOn('2026-07-01')], settings(), '2026-08-20')!;
    expect(p.nextStart).toBe('2026-07-29');
    expect(p.daysUntilNextStart).toBe(-22);
  });

  describe('phase', () => {
    const cycles = [cycleOn('2026-08-01', '2026-08-05')];

    it('is menstrual within the logged period length', () => {
      expect(predictNextCycle(cycles, settings(), '2026-08-03')!.phase).toBe('menstrual');
    });

    it('is follicular between the period and ovulation', () => {
      expect(predictNextCycle(cycles, settings(), '2026-08-09')!.phase).toBe('follicular');
    });

    it('is the ovulation window within a day either side', () => {
      expect(predictNextCycle(cycles, settings(), '2026-08-15')!.phase).toBe('ovulation');
      expect(predictNextCycle(cycles, settings(), '2026-08-16')!.phase).toBe('ovulation');
    });

    it('is luteal after ovulation', () => {
      expect(predictNextCycle(cycles, settings(), '2026-08-22')!.phase).toBe('luteal');
    });
  });
});

// --- reminders -------------------------------------------------------------

describe('upcomingReminders', () => {
  const withPrediction = (cycles: PeriodCycle[], s: CycleSettings, today: string) =>
    upcomingReminders(cycles, s, predictNextCycle(cycles, s, today), today);

  it('returns nothing when reminders are switched off', () => {
    const cycles = [cycleOn('2026-08-01')];
    expect(withPrediction(cycles, settings({ remindersEnabled: false }), '2026-08-27')).toEqual([]);
  });

  it('warns in the three days before the expected start', () => {
    const kinds = withPrediction([cycleOn('2026-08-01')], settings(), '2026-08-27').map((r) => r.kind);
    expect(kinds).toContain('period_soon');
  });

  it('flags a late period', () => {
    const kinds = withPrediction([cycleOn('2026-07-01')], settings(), '2026-08-20').map((r) => r.kind);
    expect(kinds).toContain('period_late');
    expect(kinds).not.toContain('period_soon');
  });

  it('nudges to close an open period only once it has run past its usual length', () => {
    const open = [cycleOn('2026-08-18')];
    expect(withPrediction(open, settings(), '2026-08-20').map((r) => r.kind)).not.toContain(
      'log_open_period',
    );
    expect(withPrediction(open, settings(), '2026-08-24').map((r) => r.kind)).toContain(
      'log_open_period',
    );
  });

  it('offers the fertile-window reminder only in the stages it is meaningful for', () => {
    const cycles = [cycleOn('2026-08-01')];
    const forStage = (lifeStage: CycleSettings['lifeStage']) =>
      withPrediction(cycles, settings({ lifeStage }), '2026-08-08').map((r) => r.kind);

    expect(forStage('fertility')).toContain('fertile_window');
    expect(forStage('cycling')).toContain('fertile_window');
    expect(forStage('postpartum')).not.toContain('fertile_window');
  });
});

// --- wellness derivations --------------------------------------------------

describe('mood derivations', () => {
  it('returns null rather than zero with nothing logged', () => {
    expect(averageMood([], 7, NOW)).toBeNull();
    expect(averageMood([moodAt(30, 5)], 7, NOW)).toBeNull();
  });

  it('averages only entries inside the window', () => {
    const entries = [moodAt(1, 4), moodAt(2, 2), moodAt(30, 5)];
    expect(averageMood(entries, 7, NOW)).toBe(3);
  });

  it('counts only today for the daily total', () => {
    expect(entriesToday([moodAt(0, 3), moodAt(1, 3)], NOW)).toHaveLength(1);
  });

  it('keeps the streak alive on a day not yet logged, and breaks it after a full miss', () => {
    expect(checkInStreak([moodAt(0, 3), moodAt(1, 4), moodAt(2, 2)], NOW)).toBe(3);
    // Nothing today, but yesterday and the day before — still a live streak.
    expect(checkInStreak([moodAt(1, 4), moodAt(2, 2)], NOW)).toBe(2);
    // A whole day missed between today and the last entry.
    expect(checkInStreak([moodAt(2, 2), moodAt(3, 2)], NOW)).toBe(0);
    expect(checkInStreak([], NOW)).toBe(0);
  });

  it('builds a trend oldest-first, with null for unlogged days', () => {
    const trend = moodTrend([moodAt(0, 5), moodAt(6, 1)], 7, NOW);
    expect(trend).toHaveLength(7);
    expect(trend[0]).toBe(1); // six days ago
    expect(trend[6]).toBe(5); // today
    expect(trend[3]).toBeNull();
  });

  it('averages several entries logged on the same day into one trend point', () => {
    expect(moodTrend([moodAt(0, 2), moodAt(0, 4)], 7, NOW)[6]).toBe(3);
  });

  it('ranks factors by how often they were attached', () => {
    const entries = [
      moodAt(0, 2, ['work', 'sleep']),
      moodAt(1, 3, ['work']),
      moodAt(2, 4, ['family']),
    ];
    expect(topFactors(entries, 7, NOW)[0]).toEqual({ factor: 'work', count: 2 });
  });
});

describe('LocalCbtCoach', () => {
  const coach = new LocalCbtCoach();

  it('regulates before it reframes when the mood is very low', async () => {
    const reply = await coach.respond({ level: 1, factors: ['work'], note: '', recentAverage: 2 });
    expect(reply.techniqueId).toBe('grounding');
    expect(reply.openingKey).toBe('wellness.cbt_tone_low');
  });

  it('picks breathing for a very low mood attributed to sleep', async () => {
    const reply = await coach.respond({ level: 2, factors: ['sleep'], note: '', recentAverage: 2 });
    expect(reply.techniqueId).toBe('breathing');
  });

  it('reframes for the work/money attributions at a workable mood level', async () => {
    const reply = await coach.respond({ level: 3, factors: ['money'], note: '', recentAverage: 3.4 });
    expect(reply.techniqueId).toBe('reframe');
    expect(reply.openingKey).toBe('wellness.cbt_tone_steady');
  });

  it('reads a neutral day after a rough week differently from one after a good week', async () => {
    const rough = await coach.respond({ level: 3, factors: [], note: '', recentAverage: 2.1 });
    const good = await coach.respond({ level: 3, factors: [], note: '', recentAverage: 3.8 });
    expect(rough.openingKey).toBe('wellness.cbt_tone_mixed');
    expect(good.openingKey).toBe('wellness.cbt_tone_steady');
  });

  it('always returns three resolvable step keys and stays local', async () => {
    const reply = await coach.respond({ level: 5, factors: [], note: '', recentAverage: 4.5 });
    expect(reply.stepKeys).toHaveLength(3);
    expect(reply.stepKeys[0]).toBe('wellness.cbt_gratitude_step_1');
    expect(reply.source).toBe('local');
  });
});
