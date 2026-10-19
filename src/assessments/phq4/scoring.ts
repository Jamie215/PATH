/**
 * PHQ-4 scoring.
 */
import {
  commentsOf,
  sumItems,
  type ScreenerResult,
  type ScreenerScoring,
  type Tone,
} from '../screening';

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'nervousOrAnxious', 'worrying', 'depressedOrHopeless', 'littleInterestOrPleasure'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

/** Four items rated 0–3. */
export const MAX_SCORE = 12;

/** Lower bound of each standard PHQ-4 distress band on the 0–12 total. */
export const CUTOFFS = { mild: 3, moderate: 6, severe: 9 } as const;

// --- Types -------------------------------------------------------------------

/** Ordinal rating per item: 0=Not at all … 3=Nearly every day. */
export type Experience = 0 | 1 | 2 | 3;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export type PHQ4Response = {
  [K in `${Symptom}_exp`]: Experience;
} & {
  other_comments?: string;
};

export type PHQ4Result = ScreenerResult;

// --- Scoring -----------------------------------------------------------------

export function tone(total: number): Tone {
  if (total >= CUTOFFS.severe) return 'severe';
  if (total >= CUTOFFS.moderate) return 'moderate';
  if (total >= CUTOFFS.mild) return 'mild';
  return 'normal';
}

/** Standard PHQ-4 severity bands for the 0–12 total. */
function interpret(total: number): string {
  if (total >= CUTOFFS.severe) return 'Severe psychological distress';
  if (total >= CUTOFFS.moderate) return 'Moderate psychological distress';
  if (total >= CUTOFFS.mild) return 'Mild psychological distress';
  return 'Normal — minimal distress';
}

export const SCORING: ScreenerScoring = {
  maxScore: MAX_SCORE,
  tone,
  isElevated: (total) => total >= CUTOFFS.mild,
};

/**
 * Score a PHQ-4 survey response. Each item contributes its raw ordinal rating
 * (0–3); the total is their sum.
 */
export function score(response: PHQ4Response): PHQ4Result {
  const total_score = sumItems(response, SYMPTOMS);
  return {
    total_score,
    interpretation: interpret(total_score),
    comments: commentsOf(response),
  };
}
