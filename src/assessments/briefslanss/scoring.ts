/**
 * briefSLANSS (Brief neuropathic symptoms and signs) scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'numb', 'skinDiff', 'sensitive', 'discomfort',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

const SYMPTOM_SCORES: Record<Symptom, number> = {
  numb: 1, skinDiff: 1, sensitive: 1, discomfort: 1,
};

/** Human-readable labels */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  numb: 'Numbness or pins & needles',
  skinDiff: 'Skin appearance changes',
  sensitive: 'Increased sensitivity',
  discomfort: 'Discomfort or distress',
};

// --- Types -------------------------------------------------------------------

/** Experience rating: 0=No, 1=Yes */
export type Experience = 0 | 1;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export interface briefSLANSSResponse {
  [key: `${Symptom}_exp`]: Experience;
  other_comments?: string;
}

/**
 * Result shape — identical keys to the original Python return dict so it
 * remains a drop-in replacement for the existing templates.
 */
export interface briefSLANSSResult {
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
 * Score an briefSLANSS survey response
 */
export function score(response: briefSLANSSResponse): briefSLANSSResult {
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
    interpretation: total_score > 2 ? 'Pain is predominantly neuropathic' : 'Pain is less likely to be neuropathic', //TODO: Confirm this threshold
    comments,
  };
}
