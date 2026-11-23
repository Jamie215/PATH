/**
 * MSI survey question configuration.
 *
 * Each entry corresponds to one symptom from `scoring.ts`. The frequency
 * question is always asked; the interference (bothersomeness) question
 * is asked only when frequency > 0.
 */
import { SYMPTOMS, SYMPTOM_LABELS, type Symptom } from './scoring';

export interface MSIQuestion {
  symptom: Symptom;
  /** The symptom name as quoted in the question text. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the question. */
  description?: string;
}

/** Clarifying text shown beneath the two questions that need it. */
const DESCRIPTIONS: Partial<Record<Symptom, string>> = {
  sensitive:
    'Sensitivity to your environment, e.g. bothered by certain types of light, noise, odor, or temperature.',
  foggy: 'Difficulty concentrating or remembering things.',
};

/** One question per symptom, in scoring order; labels come from scoring.ts. */
export const QUESTIONS: readonly MSIQuestion[] = SYMPTOMS.map((symptom) => ({
  symptom,
  symptomLabel: SYMPTOM_LABELS[symptom],
  description: DESCRIPTIONS[symptom],
}));

export const FREQUENCY_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Often' },
  { value: 3, label: 'Always' },
] as const;

export const INTERFERENCE_OPTIONS = [
  { value: 1, label: 'Barely Noticeable' },
  { value: 2, label: 'Somewhat Bothersome' },
  { value: 3, label: 'Quite Bothersome' },
  { value: 4, label: 'Extremely Bothersome' },
] as const;

/** Roles a user can identify as on the MSI intake. */
export type MSIRole = 'patient' | 'professional';
