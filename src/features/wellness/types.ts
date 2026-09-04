// Mental Health & CBT Coaching — SRS Module Group 2, "wellness" (M4-T6 / M4-T7).
//
// Every user-facing string in this module is an i18n key, never literal text: the
// meditation guides and CBT scripts below are *content*, and content that only
// exists in English is a defect here (agent.md rule 2). The registries therefore
// carry IDs and structure; `WellnessScreen.tsx` resolves them through `t()`.

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

/** Ascending: 1 is the hardest day, 5 is the best. */
export const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export type MoodFactor = 'work' | 'family' | 'sleep' | 'health' | 'money' | 'self';

export const MOOD_FACTORS: MoodFactor[] = [
  'work',
  'family',
  'sleep',
  'health',
  'money',
  'self',
];

export interface MoodEntry {
  /** The server's check-in UUID once synced; a local timestamp string before that. */
  id: string;
  level: MoodLevel;
  /** What the user attributed the mood to — drives which CBT technique is offered. */
  factors: MoodFactor[];
  /**
   * Server-side `tags` that don't map onto a `MoodFactor`. Kept so editing an
   * entry logged elsewhere (or by a future backend tag) doesn't silently drop them.
   */
  extraTags?: string[];
  note: string;
  /** Backend `reason` field — see the note on `MoodCheckInRequest` below. */
  reason?: string;
  loggedAt: number; // epoch ms
  /** True once the entry is known to exist on the backend, not just on this device. */
  synced?: boolean;
}

// ---------------------------------------------------------------------------
// CBT coaching
// ---------------------------------------------------------------------------

export type CbtTechniqueId = 'reframe' | 'grounding' | 'breathing' | 'gratitude';

export const CBT_TECHNIQUES: CbtTechniqueId[] = [
  'reframe',
  'grounding',
  'breathing',
  'gratitude',
];

/** Steps per technique — fixed, so the i18n key set is knowable without rendering. */
export const CBT_STEPS_PER_TECHNIQUE = 3;

export interface CbtCoachInput {
  level: MoodLevel | null;
  factors: MoodFactor[];
  note: string;
  /** Trailing 7-day mood average, or null with nothing logged yet. */
  recentAverage: number | null;
}

/**
 * A coach reply, expressed as i18n keys rather than text. A future remote coach
 * (`M8-T4`) returns generated prose instead and will need `text` fields alongside
 * these — the screen already renders through one resolver function, so that is a
 * change in one place.
 */
export interface CbtReply {
  techniqueId: CbtTechniqueId;
  /** `wellness.cbt_reply_<tone>` — the empathetic opening line. */
  openingKey: string;
  /** `wellness.cbt_<technique>_title` */
  titleKey: string;
  /** `wellness.cbt_<technique>_step_1..3` */
  stepKeys: string[];
  /** A question to sit with, `wellness.cbt_<technique>_prompt`. */
  promptKey: string;
  source: CbtCoachSource;
}

export type CbtCoachSource = 'local' | 'remote';

/**
 * The hook-point an AI provider implements later (`docs/BACKLOG.md` M4-T7 is
 * explicit that real coaching waits on `M8-T4`'s LLM integration). `LocalCbtCoach`
 * in `cbtCoach.ts` is the shipping implementation and the permanent offline
 * fallback — same "define the interface, stub it" shape as the OCR hook-point in
 * `M5-T5`, and no network call is made from this module.
 */
export interface CbtCoach {
  readonly source: CbtCoachSource;
  respond(input: CbtCoachInput): Promise<CbtReply>;
}

// ---------------------------------------------------------------------------
// Guided meditation content
// ---------------------------------------------------------------------------

export type MeditationCategory = 'breath' | 'calm' | 'sleep' | 'focus';

export const MEDITATION_CATEGORIES: MeditationCategory[] = ['breath', 'calm', 'sleep', 'focus'];

export interface MeditationGuide {
  id: string;
  category: MeditationCategory;
  minutes: number;
  /** Step count; strings live at `wellness.med_<id>_step_1..stepCount`. */
  stepCount: number;
}

export const MEDITATION_GUIDES: MeditationGuide[] = [
  { id: 'box_breath', category: 'breath', minutes: 4, stepCount: 4 },
  { id: 'body_scan', category: 'calm', minutes: 8, stepCount: 4 },
  { id: 'wind_down', category: 'sleep', minutes: 10, stepCount: 4 },
  { id: 'focus_reset', category: 'focus', minutes: 3, stepCount: 4 },
];

// ---------------------------------------------------------------------------
// Backend contract — `/api/wellness/**`
// ---------------------------------------------------------------------------
//
// Verified against the live OpenAPI document at
// `https://ikon-vpm.keross.com/saheli/v3/api-docs` and by calling every route
// with a real token (see `docs/DECISIONS.md` D-058). The wire types below are
// the server's own DTO names; the local `MoodEntry` above stays the screen's
// model, so all of `wellnessStore.ts`'s analytics and the offline
// `LocalCbtCoach` keep working unchanged when the network is unavailable.

/** Server-side mood enum. Ordered ascending and 1:1 with `MoodLevel`. */
export type BackendMood = 'VERY_LOW' | 'LOW' | 'OKAY' | 'GOOD' | 'GREAT';

/** `moodScore` in every response is exactly this index, so the mapping is lossless. */
export const MOOD_BY_LEVEL: Record<MoodLevel, BackendMood> = {
  1: 'VERY_LOW',
  2: 'LOW',
  3: 'OKAY',
  4: 'GOOD',
  5: 'GREAT',
};

const LEVEL_BY_MOOD: Record<BackendMood, MoodLevel> = {
  VERY_LOW: 1,
  LOW: 2,
  OKAY: 3,
  GOOD: 4,
  GREAT: 5,
};

export function moodToLevel(mood: BackendMood | string | null | undefined): MoodLevel {
  const level = LEVEL_BY_MOOD[mood as BackendMood];
  return level ?? 3;
}

/**
 * The backend's `tags` are free-form strings ("Work", "Fatigue", "Pressure"),
 * while this module's `MoodFactor` is a closed set that drives the offline
 * coach's technique pick and the i18n keys. These two functions are the whole
 * bridge: known factors round-trip through their capitalised tag name, and any
 * other tag the server holds is preserved verbatim on the entry (`extraTags`)
 * rather than being silently dropped on the next edit.
 */
export const FACTOR_TAGS: Record<MoodFactor, string> = {
  work: 'Work',
  family: 'Family',
  sleep: 'Sleep',
  health: 'Health',
  money: 'Money',
  self: 'Self',
};

const FACTOR_BY_TAG = new Map<string, MoodFactor>(
  (Object.keys(FACTOR_TAGS) as MoodFactor[]).map((f) => [FACTOR_TAGS[f].toLowerCase(), f]),
);

export function tagsToFactors(tags: string[] | null | undefined): MoodFactor[] {
  if (!tags) {
    return [];
  }
  const seen = new Set<MoodFactor>();
  tags.forEach((tag) => {
    const factor = FACTOR_BY_TAG.get(tag.trim().toLowerCase());
    if (factor) {
      seen.add(factor);
    }
  });
  return [...seen];
}

/** Tags the server holds that don't map onto a `MoodFactor` — shown as-is. */
export function tagsToExtras(tags: string[] | null | undefined): string[] {
  if (!tags) {
    return [];
  }
  return tags.filter((tag) => !FACTOR_BY_TAG.has(tag.trim().toLowerCase()));
}

export function factorsToTags(factors: MoodFactor[], extras: string[] = []): string[] {
  return [...factors.map((f) => FACTOR_TAGS[f]), ...extras];
}

// ---- Mood check-ins -------------------------------------------------------

export interface MoodCheckInRequest {
  mood: BackendMood;
  /**
   * Present in the demo bodies and in `MoodCheckInResponse`, but *absent* from
   * `MoodCheckInRequest` in the server's own OpenAPI schema — the backend
   * accepts it and then never persists it, so `reason` always reads back null
   * (D-058). Sent anyway so this client is already correct once that's fixed.
   */
  reason?: string;
  tags?: string[];
  note?: string;
}

export interface MoodCheckInResponse {
  id: string;
  mood: BackendMood;
  moodScore: number;
  reason: string | null;
  tags: string[] | null;
  note: string | null;
  loggedAt: string;  // ISO-8601
  createdAt: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

/** Wire DTO -> the model every screen and `wellnessStore.ts` helper already speaks. */
export function checkInToEntry(dto: MoodCheckInResponse): MoodEntry {
  const loggedAt = Date.parse(dto.loggedAt);
  return {
    id: dto.id,
    level: moodToLevel(dto.mood),
    factors: tagsToFactors(dto.tags),
    extraTags: tagsToExtras(dto.tags),
    note: dto.note ?? '',
    reason: dto.reason ?? '',
    loggedAt: Number.isNaN(loggedAt) ? Date.now() : loggedAt,
    synced: true,
  };
}

// ---- Dashboard & analytics ------------------------------------------------

export interface DailyMoodSummary {
  date: string;  // YYYY-MM-DD
  averageScore: number;
  checkInCount: number;
}

export interface TagMentionSummary {
  tag: string;
  count: number;
}

export interface WellnessSummaryResponse {
  checkInsToday: number;
  sevenDayAverage: number | null;
  dayStreak: number;
  lastSevenDays: DailyMoodSummary[];
  mostMentionedTags: TagMentionSummary[];
  latestCheckIn: MoodCheckInResponse | null;
}

// ---- Exercises ------------------------------------------------------------

export type ExerciseCategory = 'CBT_TECHNIQUE' | 'BREATH' | 'SLEEP' | 'FOCUS' | 'MINDFULNESS';

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'CBT_TECHNIQUE',
  'BREATH',
  'SLEEP',
  'FOCUS',
  'MINDFULNESS',
];

export interface WellnessExercise {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: ExerciseCategory;
  techniqueType: string;
  durationMinutes: number;
  steps: string[];
  targetMoods: BackendMood[];
}

export interface CompleteSessionRequest {
  durationMinutes: number;
}

export interface SessionCompletionResponse {
  sessionId: string;
  exerciseId: string;
  exerciseTitle: string;
  durationMinutes: number;
  completedAt: string;
}

// ---- CBT chat assistant ---------------------------------------------------

export interface CbtChatRequest {
  message: string;
}

export interface CbtChatMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  message: string;
  /** A human-readable technique name ("Ground yourself"), not the enum. */
  suggestedTechnique: string | null;
  /**
   * Null on the reply POST returns, populated on the rows `GET /cbt/history`
   * returns — which is why `handleSendChat` re-reads the transcript rather than
   * rendering the POST's own reply object.
   */
  createdAt: string | null;
}

export interface CbtRecommendationResponse {
  recommendedExercise: WellnessExercise | null;
  message: string;
  basedOnMood: BackendMood | null;
}

export interface AiMoodUpliftResponse {
  upliftMessage: string;
  suggestedActivity: string;
  affirmation: string;
  basedOnTodayMood: string | null;
}
