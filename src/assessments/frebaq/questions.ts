/**
 * FreBAQ survey question configuration.
 */
import type { Symptom } from './scoring';

export interface freBAQQuestion {
  symptom: Symptom;
  /** Short symptom name shown as the question title. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the title. */
  description?: string;
}

export const QUESTIONS: readonly freBAQQuestion[] = [
  {
    symptom: 'notPart',
    symptomLabel: 'Feels as though it is not part of the rest of my body.',
  },
  {
    symptom: 'withoutControl',
    symptomLabel: 'Sometimes it feels as though the area is moving on its own, without my control.',
  },
  {
    symptom: 'withoutKnowingMoving',
    symptomLabel: 'When performing everyday tasks, the area moves without me understanding why.',
  },
  {
    symptom: 'withoutKnowingPosition',
    symptomLabel: 'When performing everyday tasks, the area is positioned in a way that I am not aware of.',
  },
  {
    symptom: 'cantPerceiveOutline',
    symptomLabel: 'The outline or borders of the area are difficult to perceive',
  },
  {
    symptom: 'feelsLopsided',
    symptomLabel: 'The area feels very lopsided, or out of proportion, to what it should be or compared to that on the opposite side.',
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Occasionally' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Always' },
] as const;