// Hormonal Health & Life-Stage Tracking — SRS Module Group 2, "cycle" (M4-T8 / M4-T9).
//
// Same content rule as the wellness module: the life-stage guidance below is a
// registry of IDs, and every word the user reads is resolved through `t()`.

/** Dates are stored as `YYYY-MM-DD` local-calendar strings, never epoch ms. */
export type ISODate = string;

export type FlowLevel = 'light' | 'medium' | 'heavy';

export const FLOW_LEVELS: FlowLevel[] = ['light', 'medium', 'heavy'];

export type CycleSymptom =
  | 'cramps'
  | 'headache'
  | 'fatigue'
  | 'bloating'
  | 'mood_swings'
  | 'tender_breasts'
  | 'acne'
  | 'insomnia';

export const CYCLE_SYMPTOMS: CycleSymptom[] = [
  'cramps',
  'headache',
  'fatigue',
  'bloating',
  'mood_swings',
  'tender_breasts',
  'acne',
  'insomnia',
];

export interface PeriodCycle {
  id: string;
  startDate: ISODate;
  /** Null while the period is still ongoing. */
  endDate: ISODate | null;
  flow: FlowLevel;
  symptoms: CycleSymptom[];
  note: string;
}

/**
 * The SRS's four dedicated support areas plus the ordinary tracking case.
 * `lifeStage` changes what the screen predicts and what guidance it shows — it is
 * not a cosmetic label.
 */
export type LifeStage = 'cycling' | 'fertility' | 'postpartum' | 'perimenopause' | 'menopause';

export const LIFE_STAGES: LifeStage[] = [
  'cycling',
  'fertility',
  'postpartum',
  'perimenopause',
  'menopause',
];

/** Guidance items per stage — `cycle.stage_<stage>_nutrition_1..N` / `_exercise_1..N`. */
export const GUIDANCE_ITEMS_PER_STAGE = 3;

export interface CycleSettings {
  lifeStage: LifeStage;
  /** User's own expectation; used until enough logged cycles exist to beat it. */
  averageCycleLength: number;
  averagePeriodLength: number;
  remindersEnabled: boolean;
}

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  lifeStage: 'cycling',
  averageCycleLength: 28,
  averagePeriodLength: 5,
  remindersEnabled: true,
};

// A cycle shorter than 21 or longer than 45 days is almost always a mis-logged date
// rather than a real cycle, and letting one through drags the mean far enough to make
// every later prediction wrong. Out-of-range gaps are excluded from the average, not
// clamped into it — clamping would still let a typo pull the mean.
export const MIN_CYCLE_LENGTH = 21;
export const MAX_CYCLE_LENGTH = 45;

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export const CYCLE_PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

/**
 * `low` means the prediction is the user's configured default with no logged history
 * behind it — the screen says so rather than presenting a guess as a forecast.
 */
export type PredictionConfidence = 'low' | 'medium' | 'high';

export interface CyclePrediction {
  nextStart: ISODate;
  ovulationDate: ISODate;
  fertileStart: ISODate;
  fertileEnd: ISODate;
  phase: CyclePhase;
  /** 1-based day within the current cycle. */
  dayOfCycle: number;
  /** Negative once the expected date has passed — i.e. the period is late. */
  daysUntilNextStart: number;
  averageCycleLength: number;
  averagePeriodLength: number;
  confidence: PredictionConfidence;
  /** How many completed cycle-to-cycle gaps the average was computed from. */
  samples: number;
}

export type ReminderKind = 'period_soon' | 'fertile_window' | 'period_late' | 'log_open_period';

export interface CycleReminder {
  id: string;
  kind: ReminderKind;
  date: ISODate;
  /** Days from today; negative means it has already passed. */
  daysAway: number;
}
