import {
  CBT_STEPS_PER_TECHNIQUE,
  type CbtCoach,
  type CbtCoachInput,
  type CbtReply,
  type CbtTechniqueId,
  type MoodFactor,
} from './types';

/**
 * The offline CBT coach.
 *
 * `docs/BACKLOG.md` M4-T7 is explicit that real AI coaching waits on `M8-T4`'s LLM
 * integration, and D-002 forbids network calls outside auth/profile/family — so this
 * makes none. It is a deterministic mapping from "how the person just described their
 * state" to one of four standard CBT/regulation techniques, returning i18n keys the
 * screen resolves. That keeps the coaching multi-language by construction instead of
 * English-first with translation bolted on later.
 *
 * It is deliberately *not* a chatbot pretending to be a therapist. It reflects back
 * what was logged, names a technique, and walks three concrete steps — which is the
 * honest offline version of the SRS's "empathetic AI CBT Assistant" and the fallback
 * a remote coach still needs when the device is offline.
 */

// Which technique best fits which attribution. Sleep and health are body-state
// problems, so they get breathing/grounding rather than cognitive reframing;
// work and money are the classic catastrophising pair, so they get reframe.
const FACTOR_TECHNIQUE: Record<MoodFactor, CbtTechniqueId> = {
  work: 'reframe',
  money: 'reframe',
  family: 'gratitude',
  self: 'gratitude',
  sleep: 'breathing',
  health: 'grounding',
};

function pickTechnique(input: CbtCoachInput): CbtTechniqueId {
  // A very low mood is a regulation problem before it is a thinking problem —
  // asking someone at level 1 to restructure a thought is the wrong order.
  if (input.level !== null && input.level <= 2) {
    return input.factors.includes('sleep') ? 'breathing' : 'grounding';
  }
  const fromFactor = input.factors.map((f) => FACTOR_TECHNIQUE[f]).find(Boolean);
  if (fromFactor) {
    return fromFactor;
  }
  if (input.level !== null && input.level >= 4) {
    return 'gratitude';
  }
  return 'reframe';
}

/** Tone of the opening line — the empathetic half, separate from the technique. */
function pickTone(input: CbtCoachInput): 'low' | 'mixed' | 'steady' | 'bright' {
  if (input.level === null) {
    return 'mixed';
  }
  if (input.level <= 2) {
    return 'low';
  }
  if (input.level === 3) {
    // A neutral day that follows a rough week reads differently from a neutral day
    // in a good week, and saying so is most of what "empathetic" means here.
    return input.recentAverage !== null && input.recentAverage < 2.6 ? 'mixed' : 'steady';
  }
  return 'bright';
}

export class LocalCbtCoach implements CbtCoach {
  readonly source = 'local' as const;

  async respond(input: CbtCoachInput): Promise<CbtReply> {
    const techniqueId = pickTechnique(input);
    const tone = pickTone(input);

    return {
      techniqueId,
      openingKey: `wellness.cbt_tone_${tone}`,
      titleKey: `wellness.cbt_${techniqueId}_title`,
      stepKeys: Array.from(
        { length: CBT_STEPS_PER_TECHNIQUE },
        (_, i) => `wellness.cbt_${techniqueId}_step_${i + 1}`,
      ),
      promptKey: `wellness.cbt_${techniqueId}_prompt`,
      source: this.source,
    };
  }
}

/**
 * The single instance the screen talks to. Swapping in a remote coach at `M8-T4` is
 * a change to this line plus a class that implements the same interface — no screen
 * change, because the screen only ever sees `CbtCoach`.
 */
export const cbtCoach: CbtCoach = new LocalCbtCoach();
