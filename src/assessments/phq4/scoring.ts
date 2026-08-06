/**
 * PHQ-4 scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'nervousOrAnxious', 'worrying', 'depressedOrHopeless', 'littleInterestOrPleasure'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

// --- Types -------------------------------------------------------------------

/** Ordinal rating per item: 0=Not at all … 3=Nearly every day. Four items → total 0–12. */
export type Experience = 0 | 1 | 2 | 3;

/** Standard PHQ-4 severity bands for the 0–12 total. */
function interpret(total: number): string {
  if (total >= 9) return 'Severe psychological distress';
  if (total >= 6) return 'Moderate psychological distress';
  if (total >= 3) return 'Mild psychological distress';
  return 'Normal — minimal distress';
}

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export type phq4Response = {
  [K in `${Symptom}_exp`]: Experience;
} & {
  other_comments?: string;
};

/**
 * Result shape — identical keys to the original Python return dict so it
 * remains a drop-in replacement for the existing templates.
 */
export interface phq4Result {
  total_score: number;
  interpretation: string;
  comments: string;
}

/**
 * Score an PHQ-4 survey response. Each item contributes its raw ordinal rating
 * (0–3); the total is their sum.
 */
export function score(response: phq4Response): phq4Result {
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
    interpretation: interpret(total_score),
    comments,
  };
}
