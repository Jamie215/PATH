/**
 * briefSLANSS (Brief neuropathic symptoms and signs) scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'numb', 'skinDiff', 'sensitive', 'discomfort',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

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

/**
 * Score an briefSLANSS survey response. Each symptom is a Yes/No (0/1); the
 * total is the count of Yes answers.
 */
export function score(response: briefSLANSSResponse): briefSLANSSResult {
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
    interpretation: total_score > 2 ? 'Pain is predominantly neuropathic' : 'Pain is less likely to be neuropathic', //TODO: Confirm this threshold
    comments,
  };
}
