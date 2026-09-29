/**
 * briefSLANSS (Brief neuropathic symptoms and signs) scoring.
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
  'numb', 'skinDiff', 'sensitive', 'discomfort',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

/** Four Yes/No items. */
export const MAX_SCORE = 4;

/**
 * Totals at or above this are read as "predominantly neuropathic".
 * TODO: confirm this threshold with the PI.
 */
export const NEUROPATHIC_CUTOFF = 3;

// --- Types -------------------------------------------------------------------

/** Experience rating: 0=No, 1=Yes */
export type Experience = 0 | 1;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export type BriefSLANSSResponse = {
  [K in `${Symptom}_exp`]: Experience;
} & {
  other_comments?: string;
};

export type BriefSLANSSResult = ScreenerResult;

// --- Scoring -----------------------------------------------------------------

const isElevated = (total: number): boolean => total >= NEUROPATHIC_CUTOFF;

export function tone(total: number): Tone {
  return isElevated(total) ? 'elevated' : 'normal';
}

export const SCORING: ScreenerScoring = { maxScore: MAX_SCORE, tone, isElevated };

/**
 * Score a briefSLANSS survey response. Each symptom is a Yes/No (0/1); the
 * total is the count of Yes answers.
 */
export function score(response: BriefSLANSSResponse): BriefSLANSSResult {
  const total_score = sumItems(response, SYMPTOMS);
  return {
    total_score,
    interpretation: isElevated(total_score)
      ? 'Pain is predominantly neuropathic'
      : 'Pain is less likely to be neuropathic',
    comments: commentsOf(response),
  };
}
