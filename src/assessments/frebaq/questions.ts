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

// 0-based ordinal scale (0–4 per item → 0–24 total), matching the FreBAQ
// scoring the composite Pain Classification model was calibrated on.
export const EXPERIENCE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Occasionally' },
  { value: 3, label: 'Often' },
  { value: 4, label: 'Always' },
] as const;