/**
 * Shared shape for the single-total screeners (PHQ-4, Brief S-LANSS, FreBAQ).
 *
 * Each screener's `scoring.ts` is the single source of truth for its clinical
 * constants — maximum score, cutoffs, band labels — and exposes them through a
 * `ScreenerScoring` object. The results view, the PDF report and the Pain
 * Classification composite all read from there rather than keeping their own
 * copies, so changing a cutoff is a one-line edit.
 */
import type { OmrTemplate } from './omr/types';

/**
 * Visual severity of a band, shared by the results card and the PDF.
 * `normal` = below every cutoff; `elevated` = the single positive band of a
 * binary screener; `mild`/`moderate`/`severe` = graded bands (PHQ-4).
 */
export type Tone = 'normal' | 'elevated' | 'mild' | 'moderate' | 'severe';

/** One rated item of a single-total screener, as the survey shows it. */
export interface ScreenerQuestion<S extends string = string> {
  /** Item key; the answer is stored as `<symptom>_exp`. */
  symptom: S;
  /** The item's wording, shown as the question title. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the title. */
  description?: string;
}

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

/**
 * Everything the app needs to run one single-total screener: the survey, its
 * scoring, its printable answer sheet and its results report. Each screener
 * exports one from its `definition.ts`; `screeners.ts` lists them. The survey,
 * results view, PDF, pages, patient review and Pain Classification all read
 * from here, so adding a screener means writing its questions, scoring,
 * answer sheet and definition, then listing it. Its name and description live
 * in `registry.ts`.
 */
export interface ScreenerDefinition {
  /** Folder and URL name, e.g. `phq4`. Must match its `registry.ts` entry. */
  slug: string;
  /** Items in display order; answers are stored as `<symptom>_exp`. */
  questions: readonly ScreenerQuestion[];
  /** The rating scale every item uses, lowest value first. */
  options: readonly { value: number; label: string }[];
  /** Instruction shown above the questions. */
  intro: string;
  /** Maximum score and bands, from the screener's `scoring.ts`. */
  scoring: ScreenerScoring;
  /** Score a stored survey response. */
  score(response: Record<string, number | string>): ScreenerResult;
  /** The printable, scannable answer sheet. */
  omrTemplate: OmrTemplate;
  /** Text for the PDF results report. */
  report: {
    /** Title-block heading and subtitle. */
    heading: string;
    subtitle: string;
    /** Explanatory note printed under the score card. */
    note: string;
    /** Start of the downloaded file name (before patient name and date). */
    filenamePrefix: string;
  };
  /**
   * A free-text "most bothersome area" asked before the items (FreBAQ). Its
   * value is stored as `bothersome_area` and woven into the item wording.
   */
  areaField?: {
    label: string;
    placeholder: string;
    /** Clean a typed area before it is stored or shown. */
    normalize(text: string): string;
    /** Rewrite an item's wording around the area. */
    personalize(label: string, area: string): string;
  };
}

/** The standard note line that ends every screener report. */
export const SCREENING_DISCLAIMER = 'This is a screening result, not a diagnosis.';
