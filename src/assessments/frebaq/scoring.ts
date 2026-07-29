/**
 * FreBAQ scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'notPart', 'withoutControl', 'withoutKnowingMoving', 'withoutKnowingPosition', 'cantPerceiveOutline', 'feelsLopsided'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

// --- Types -------------------------------------------------------------------

/** Ordinal rating per item: 0=Never … 4=Always. Six items → total 0–24. */
export type Experience = 0 | 1 | 2 | 3 | 4;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export interface freBAQResponse {
  [key: `${Symptom}_exp`]: Experience;
  /** Free-text body region the respondent named as most bothersome. Context
   *  only — not scored. */
  bothersome_area?: string;
  other_comments?: string;
}

/**
 * Result shape — identical keys to the original Python return dict so it
 * remains a drop-in replacement for the existing templates.
 */
export interface freBAQResult {
  total_score: number;
  interpretation: string;
  comments: string;
}

/**
 * Score an freBAQ survey response. Each item contributes its raw ordinal
 * rating (0–4); the total is their sum.
 */
export function score(response: freBAQResponse): freBAQResult {
  let total_score = 0;

  for (const symptom of SYMPTOMS) {
    total_score += (response[`${symptom}_exp`] ?? 0) as Experience;
  }

  const comments =
    typeof response.other_comments === 'string' && response.other_comments.length > 0
      ? response.other_comments
      : 'No comment provided.';

  return {
    total_score,
    interpretation: "Higher score indicates the greater disorder in the body's perception",
    comments,
  };
}
