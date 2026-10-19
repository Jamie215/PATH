/**
 * FreBAQ scoring.
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
  'notPart', 'withoutControl', 'withoutKnowingMoving', 'withoutKnowingPosition', 'cantPerceiveOutline', 'feelsLopsided'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

/** Six items rated 0–4. */
export const MAX_SCORE = 24;

/**
 * FreBAQ has no firm validated cutoff; totals in the upper half of the 0–24
 * range are flagged as elevated body-perception disruption.
 * TODO: confirm this threshold with the PI.
 */
export const ELEVATED_CUTOFF = 12;

// --- Types -------------------------------------------------------------------

/** Ordinal rating per item: 0=Never … 4=Always. */
export type Experience = 0 | 1 | 2 | 3 | 4;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export type FreBAQResponse = {
  [K in `${Symptom}_exp`]: Experience;
} & {
  /** Free-text body region the respondent named as most bothersome. Context
   *  only — not scored. */
  bothersome_area?: string;
  other_comments?: string;
};

export type FreBAQResult = ScreenerResult;

// --- Scoring -----------------------------------------------------------------

const isElevated = (total: number): boolean => total >= ELEVATED_CUTOFF;

export function tone(total: number): Tone {
  return isElevated(total) ? 'elevated' : 'normal';
}

export const SCORING: ScreenerScoring = { maxScore: MAX_SCORE, tone, isElevated };

/**
 * Score a FreBAQ survey response. Each item contributes its raw ordinal
 * rating (0–4); the total is their sum.
 */
export function score(response: FreBAQResponse): FreBAQResult {
  return {
    total_score: sumItems(response, SYMPTOMS),
    interpretation: "Higher score indicates the greater disorder in the body's perception",
    comments: commentsOf(response),
  };
}
