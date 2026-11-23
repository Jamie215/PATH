/**
 * Brief S-LANSS (Sensory Profile) — everything the app needs to run it.
 * See `ScreenerDefinition` in ../screening.ts.
 */
import { SCREENING_DISCLAIMER, type ScreenerDefinition } from '../screening';
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { NEUROPATHIC_CUTOFF, SCORING, score, type BriefSLANSSResponse } from './scoring';
import { BRIEFSLANSS_OMR_TEMPLATE } from './omr-template';

export const BRIEFSLANSS: ScreenerDefinition = {
  slug: 'briefslanss',
  questions: QUESTIONS,
  options: EXPERIENCE_OPTIONS,
  intro: 'For each item below, indicate whether you have experienced the symptom.',
  scoring: SCORING,
  score: (r) => score(r as unknown as BriefSLANSSResponse),
  omrTemplate: BRIEFSLANSS_OMR_TEMPLATE,
  report: {
    heading: 'Sensory Profile',
    subtitle: 'Brief neuropathic symptoms and signs — results report',
    note:
      `Scores at or above ${NEUROPATHIC_CUTOFF} suggest a predominantly neuropathic pain ` +
      `mechanism. ${SCREENING_DISCLAIMER}`,
    filenamePrefix: 'Sensory_Profile_Results',
  },
};
