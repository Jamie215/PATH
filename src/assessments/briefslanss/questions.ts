/**
 * briefSLANSS survey question configuration.
 */
import type { Symptom } from './scoring';

export interface briefSLANSSQuestion {
  symptom: Symptom;
  /** Short symptom name shown as the question title. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the title. */
  description?: string;
}

export const QUESTIONS: readonly briefSLANSSQuestion[] = [
  {
    symptom: 'numb',
    symptomLabel: 'Numbness, tingling, or prickling sensations',
    description: 'For example, "pins and needles" in the area.',
  },
  {
    symptom: 'skinDiff',
    symptomLabel: 'Changes in skin appearance in the area',
    description: 'For example, the skin looking mottled, red, or darker than usual when the pain is particularly bad.',
  },
  {
    symptom: 'sensitive',
    symptomLabel: 'Abnormal sensitivity of the skin to touch',
    description: 'The skin over the area feels abnormally sensitive to touch.',
  },
  {
    symptom: 'discomfort',
    symptomLabel: 'Unusual discomfort when lightly rubbing the skin',
    description: 'Gently rub the area with your finger, then rub a non-painful area (e.g., the opposite side). Do you feel discomfort such as tingling or burning in the painful area that differs from the non-painful area?',
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;