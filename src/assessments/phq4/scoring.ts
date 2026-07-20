/**
 * PHQ-4 scoring.
 */

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'nervousOrAnxious', 'worrying', 'depressedOrHopeless', 'littleInterestOrPleasure'
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

const SYMPTOM_SCORES: Record<Symptom, number> = {
  nervousOrAnxious: 1, worrying: 1, depressedOrHopeless: 1, littleInterestOrPleasure: 1,
};

/** Human-readable labels */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  nervousOrAnxious: 'Nervous or anxious',
  worrying: 'Worrying',
  depressedOrHopeless: 'Depressed or hopeless',
  littleInterestOrPleasure: 'Little interest or pleasure',
};

// --- Types -------------------------------------------------------------------

/** Experience rating: 0=No, 1=Yes */
export type Experience = 0 | 1;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_exp` is always present (required).
 */
export interface PHQ4Response {
  [key: `${Symptom}_exp`]: Experience;
  other_comments?: string;
}

/**
 * Result shape — identical keys to the original Python return dict so it
 * remains a drop-in replacement for the existing templates.
 */
export interface PHQ4Result {
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
 * Score an PHQ-4 survey response
 */
export function score(response: PHQ4Response): PHQ4Result {
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

  const MILD_THRESHOLD = 2;
  const MODERATE_THRESHOLD = 5;
  const SEVERE_THRESHOLD = 8;

  const interpretation = $derived(
  !total_score 
    ? 'unknown' 
    : total_score > SEVERE_THRESHOLD ? 'Severe'
    : total_score > MODERATE_THRESHOLD ? 'Moderate'
    : total_score > MILD_THRESHOLD ? 'Mild'
    : 'None'
  );

  return {
    total_score,
    interpretation,
    comments,
  };
}
