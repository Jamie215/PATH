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

// Item wording carries placeholders expanded by `personalizeFreBAQItem`:
//   {Area}/{area} — the bothersome region ("My right knee" / "my right knee"),
//                   or "The area"/"the area" when none has been given yet.
//   {a|b}         — number-sensitive pair: the singular form when the region
//                   reads as singular, the plural form otherwise ("{is|are}",
//                   "{it|they}", "{its|their}", and "feel{s|}" for the verb -s).
// So a plural region reads with agreement ("My hands feel … they are …").
export const QUESTIONS: readonly freBAQQuestion[] = [
  {
    symptom: 'notPart',
    symptomLabel: '{Area} feel{s|} as though {it|they} {is|are} not part of the rest of my body.',
  },
  {
    symptom: 'withoutControl',
    symptomLabel: 'Sometimes {it|they} feel{s|} as though {area} {is|are} moving on {its|their} own, without my control.',
  },
  {
    symptom: 'withoutKnowingMoving',
    symptomLabel: 'When performing everyday tasks, {area} move{s|} without me understanding why.',
  },
  {
    symptom: 'withoutKnowingPosition',
    symptomLabel: 'When performing everyday tasks, {area} {is|are} positioned in a way that I am not aware of.',
  },
  {
    symptom: 'cantPerceiveOutline',
    symptomLabel: 'The outline or borders of {area} are difficult to perceive.',
  },
  {
    symptom: 'feelsLopsided',
    symptomLabel: '{Area} feel{s|} very lopsided, or out of proportion, to what {it|they} should be or compared to that on the opposite side.',
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