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
  id: string;
  level: MoodLevel;
  /** What the user attributed the mood to — drives which CBT technique is offered. */
  factors: MoodFactor[];
  note: string;
  loggedAt: number; // epoch ms
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
