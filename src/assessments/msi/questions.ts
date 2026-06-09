/**
 * MSI survey question configuration.
 *
 * Each entry corresponds to one symptom from `scoring.ts`. The frequency
 * question is always asked; the interference (bothersomeness) question
 * is asked only when frequency > 0.
 *
 * Question wording is preserved from the original PythonAnywhere survey.
 */
import type { Symptom } from './scoring';

export interface MSIQuestion {
  symptom: Symptom;
  /** The symptom name as quoted in the question text. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the question. */
  description?: string;
}

export const QUESTIONS: readonly MSIQuestion[] = [
  { symptom: 'sharp', symptomLabel: 'Sharp or shooting pain' },
  { symptom: 'dull', symptomLabel: 'General dull achiness' },
  { symptom: 'stiff', symptomLabel: 'Stiffness or restricted movement' },
  { symptom: 'weak', symptomLabel: 'Weakness, clumsiness, or giving way' },
  {
    symptom: 'sensitive',
    symptomLabel: 'Increased sensitivity',
    description:
      'Sensitivity to your environment, e.g. bothered by certain types of light, noise, odor, or temperature.',
  },
  { symptom: 'numb', symptomLabel: 'Numbness or pins & needles' },
  { symptom: 'fatigue', symptomLabel: 'Fatigue' },
  {
    symptom: 'foggy',
    symptomLabel: 'Fogginess',
    description: 'Difficulty concentrating or remembering things.',
  },
  { symptom: 'nausea', symptomLabel: 'Poor appetite or nausea' },
  { symptom: 'anxiety', symptomLabel: 'Nervousness, anxiety or sadness' },
] as const;

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
