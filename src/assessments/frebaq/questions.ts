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
    symptomLabel: 'Not part of my body',
    description: 'Feels as though it is not part of the rest of my body.',
  },
  {
    symptom: 'withoutControl',
    symptomLabel: 'Move on its own',
    description: 'Sometimes it feels as though the area is moving on its own, without my control.',
  },
  {
    symptom: 'withoutKnowingMoving',
    symptomLabel: 'Move without knowing',
    description: 'When performing everyday tasks, the area moves without me understanding why.',
  },
  {
    symptom: 'withoutKnowingPosition',
    symptomLabel: 'Position without knowing',
    description: 'When performing everyday tasks, the area is positioned in a way that I am not aware of.',
  },
  {
    symptom: 'cantPerceiveOutline',
    symptomLabel: 'Cannot perceive outline ',
    description: 'The outline or borders of the area are difficult to perceive',
  },
  {
    symptom: 'feelsLopsided',
    symptomLabel: 'Feels very lopsided',
    description: 'The area feels very lopsided, or out of proportion, to what it should be or compared to that on the opposite side.',
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 1, label: 'Never (1)' },
  { value: 2, label: 'Rarely (2)' },
  { value: 3, label: 'Occasionally (3)' },
  { value: 4, label: 'Often (4)' },
  { value: 5, label: 'Always (5)' },
] as const;