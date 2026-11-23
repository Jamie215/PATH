/**
 * FreBAQ (Body Awareness) — everything the app needs to run it, including the
 * "most bothersome area" asked before the items. See `ScreenerDefinition` in
 * ../screening.ts.
 */
import { SCREENING_DISCLAIMER, type ScreenerDefinition } from '../screening';
import { QUESTIONS, EXPERIENCE_OPTIONS, AREA_FIELD } from './questions';
import { ELEVATED_CUTOFF, MAX_SCORE, SCORING, score, type FreBAQResponse } from './scoring';
import { normalizeBothersomeArea, personalizeFreBAQItem } from './area';
import { FREBAQ_OMR_TEMPLATE } from './omr-template';

export const FREBAQ: ScreenerDefinition = {
  slug: 'frebaq',
  questions: QUESTIONS,
  options: EXPERIENCE_OPTIONS,
  intro: 'For each item below, rate your experience in the area of interest.',
  scoring: SCORING,
  score: (r) => score(r as unknown as FreBAQResponse),
  omrTemplate: FREBAQ_OMR_TEMPLATE,
  report: {
    heading: 'FreBAQ',
    subtitle: 'Body Awareness — results report',
    note:
      'The FreBAQ measures disrupted body perception (body awareness); higher ' +
      `scores indicate greater disruption. Scores at or above ${ELEVATED_CUTOFF} ` +
      `(the upper half of the 0–${MAX_SCORE} range) are flagged as elevated. ` +
      SCREENING_DISCLAIMER,
    filenamePrefix: 'Body_Awareness_Results',
  },
  areaField: {
    ...AREA_FIELD,
    normalize: normalizeBothersomeArea,
    personalize: personalizeFreBAQItem,
  },
};
