/**
 * Shared shape for the single-total screeners (PHQ-4, Brief S-LANSS, FreBAQ).
 *
 * Each screener's `scoring.ts` is the single source of truth for its clinical
 * constants — maximum score, cutoffs, band labels — and exposes them through a
 * `ScreenerScoring` object. The results view, the PDF report and the Pain
 * Classification composite all read from there rather than keeping their own
 * copies, so changing a cutoff is a one-line edit.
 */

/**
 * Visual severity of a band, shared by the results card and the PDF.
 * `normal` = below every cutoff; `elevated` = the single positive band of a
 * binary screener; `mild`/`moderate`/`severe` = graded bands (PHQ-4).
 */
export type Tone = 'normal' | 'elevated' | 'mild' | 'moderate' | 'severe';

export interface ScreenerResult {
  total_score: number;
  interpretation: string;
  comments: string;
}

export interface ScreenerScoring {
  /** Highest possible total. */
  maxScore: number;
  /** Visual band for a total. */
  tone(total: number): Tone;
  /** True when the total is at or above the screener's first cutoff. */
  isElevated(total: number): boolean;
}

/**
 * Sum the `<symptom>_exp` item ratings. A missing item counts as 0: the survey
 * forms require every item before scoring, so this only matters for callers
 * that bypass them.
 */
export function sumItems(
  response: Record<string, unknown>,
  symptoms: readonly string[],
): number {
  let total = 0;
  for (const symptom of symptoms) {
    const v = response[`${symptom}_exp`];
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

/** The free-text comment, or the report's placeholder when none was given. */
export function commentsOf(response: { other_comments?: string }): string {
  return typeof response.other_comments === 'string' && response.other_comments.length > 0
    ? response.other_comments
    : 'No comment provided.';
}
