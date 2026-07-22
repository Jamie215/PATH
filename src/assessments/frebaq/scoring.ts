/**
 * FreBAQ scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'notPart', 'withoutControl', 'withoutKnowingMoving', 'withoutKnowingPosition', 'cantPerceiveOutline', 'feelsLopsided'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

const SYMPTOM_SCORES: Record<Symptom, number> = {
  notPart: 1, withoutControl: 1, withoutKnowingMoving: 1, withoutKnowingPosition: 1, cantPerceiveOutline: 1, feelsLopsided: 1,
};

/** Human-readable labels */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  notPart: 'Not part of my body',
  withoutControl: 'Move on its own',
  withoutKnowingMoving: 'Move without knowing',
  withoutKnowingPosition: 'Position without knowing',
  cantPerceiveOutline: 'Cannot perceive outline',
  feelsLopsided: 'Feels very lopsided', 
};

// --- Types -------------------------------------------------------------------

/** Ordinal rating per item: 0=Never … 4=Always. Six items → total 0–24. */
export type Experience = 0 | 1 | 2 | 3 | 4;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export interface freBAQResponse {
  [key: `${Symptom}_exp`]: Experience;
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

/** Look up the score for a single (symptom, experience) */
function symptomScore(
  symptom: Symptom,
  exp: Experience,
): number {
  return SYMPTOM_SCORES[symptom] * exp;
}

/**
 * Score an freBAQ survey response
 */
export function score(response: freBAQResponse): freBAQResult {
  let total_score = 0;

  for (const symptom of SYMPTOMS) {
    const exp = (response[`${symptom}_exp`] ?? 0) as Experience;
    const value = symptomScore(symptom, exp);
    total_score += value;
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
