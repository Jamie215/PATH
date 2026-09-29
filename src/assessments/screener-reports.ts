/**
 * Per-screener report copy for the single-total screeners (PHQ-4, Brief
 * S-LANSS, FreBAQ): everything their results view and PDF report need beyond
 * the scoring itself. Kept free of pdf-lib so results views can import it
 * without pulling in the PDF bundle (lib/screening-pdf.ts is lazy-loaded).
 */
import type { ScreenerScoring } from './screening';
import { SCORING as PHQ4_SCORING, CUTOFFS as PHQ4_CUTOFFS } from './phq4/scoring';
import {
  SCORING as SLANSS_SCORING,
  NEUROPATHIC_CUTOFF,
} from './briefslanss/scoring';
import {
  SCORING as FREBAQ_SCORING,
  ELEVATED_CUTOFF as FREBAQ_CUTOFF,
  MAX_SCORE as FREBAQ_MAX,
} from './frebaq/scoring';

export type ScreenerSlug = 'phq4' | 'briefslanss' | 'frebaq';

export interface ScreenerReport {
  slug: ScreenerSlug;
  scoring: ScreenerScoring;
  /** Friendly name shown in the UI and the PDF metadata. */
  name: string;
  /** PDF title-block heading and subtitle. */
  pdfHeading: string;
  pdfSubtitle: string;
  /** Explanatory note printed under the PDF score card. */
  note: string;
  /** Downloaded filename prefix (before the patient name / date). */
  filenamePrefix: string;
  /** Show the respondent's "most bothersome area" on the results view. */
  showArea?: boolean;
}

const SCREENING_DISCLAIMER = 'This is a screening result, not a diagnosis.';

export const SCREENER_REPORTS: Record<ScreenerSlug, ScreenerReport> = {
  phq4: {
    slug: 'phq4',
    scoring: PHQ4_SCORING,
    name: 'Anxiety & Depression',
    pdfHeading: 'PHQ-4',
    pdfSubtitle: 'Anxiety & Depression — results report',
    note:
      `PHQ-4 total score bands: 0–${PHQ4_CUTOFFS.mild - 1} normal, ` +
      `${PHQ4_CUTOFFS.mild}–${PHQ4_CUTOFFS.moderate - 1} mild, ` +
      `${PHQ4_CUTOFFS.moderate}–${PHQ4_CUTOFFS.severe - 1} moderate, ` +
      `${PHQ4_CUTOFFS.severe}–${PHQ4_SCORING.maxScore} severe psychological distress ` +
      `(combined anxiety and depression screen). ${SCREENING_DISCLAIMER}`,
    filenamePrefix: 'Anxiety_Depression_Results',
  },
  briefslanss: {
    slug: 'briefslanss',
    scoring: SLANSS_SCORING,
    name: 'Sensory Profile',
    pdfHeading: 'Sensory Profile',
    pdfSubtitle: 'Brief neuropathic symptoms and signs — results report',
    note:
      `Scores at or above ${NEUROPATHIC_CUTOFF} suggest a predominantly neuropathic pain ` +
      `mechanism. ${SCREENING_DISCLAIMER}`,
    filenamePrefix: 'Sensory_Profile_Results',
  },
  frebaq: {
    slug: 'frebaq',
    scoring: FREBAQ_SCORING,
    name: 'Body Awareness',
    pdfHeading: 'FreBAQ',
    pdfSubtitle: 'Body Awareness — results report',
    note:
      'The FreBAQ measures disrupted body perception (body awareness); higher ' +
      `scores indicate greater disruption. Scores at or above ${FREBAQ_CUTOFF} ` +
      `(the upper half of the 0–${FREBAQ_MAX} range) are flagged as elevated. ` +
      SCREENING_DISCLAIMER,
    filenamePrefix: 'Body_Awareness_Results',
    showArea: true,
  },
};
