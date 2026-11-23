/**
 * PHQ-4 (Anxiety & Depression) — everything the app needs to run it.
 * See `ScreenerDefinition` in ../screening.ts.
 */
import { SCREENING_DISCLAIMER, type ScreenerDefinition } from '../screening';
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { CUTOFFS, MAX_SCORE, SCORING, score, type PHQ4Response } from './scoring';
import { PHQ4_OMR_TEMPLATE } from './omr-template';

export const PHQ4: ScreenerDefinition = {
  slug: 'phq4',
  questions: QUESTIONS,
  options: EXPERIENCE_OPTIONS,
  intro: 'Over the last 2 weeks, how often have you been bothered by the following?',
  scoring: SCORING,
  score: (r) => score(r as unknown as PHQ4Response),
  omrTemplate: PHQ4_OMR_TEMPLATE,
  report: {
    heading: 'PHQ-4',
    subtitle: 'Anxiety & Depression — results report',
    note:
      `PHQ-4 total score bands: 0–${CUTOFFS.mild - 1} normal, ` +
      `${CUTOFFS.mild}–${CUTOFFS.moderate - 1} mild, ` +
      `${CUTOFFS.moderate}–${CUTOFFS.severe - 1} moderate, ` +
      `${CUTOFFS.severe}–${MAX_SCORE} severe psychological distress ` +
      `(combined anxiety and depression screen). ${SCREENING_DISCLAIMER}`,
    filenamePrefix: 'Anxiety_Depression_Results',
  },
};
