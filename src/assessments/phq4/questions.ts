/**
 * PHQ-4 survey question configuration.
 */
import type { Symptom } from './scoring';

export interface phq4Question {
  symptom: Symptom;
  /** Short symptom name shown as the question title. */
  symptomLabel: string;
  /** Optional clarifying text shown beneath the title. */
  description?: string;
}

export const QUESTIONS: readonly phq4Question[] = [
  {
    symptom: 'nervousOrAnxious',
    symptomLabel: 'Feeling nervous, anxious, or on edge',
  },
  {
    symptom: 'worrying',
    symptomLabel: 'Not being able to stop or control worrying.',
  },
  {
    symptom: 'depressedOrHopeless',
    symptomLabel: 'Feeling down, depressed, or hopeless',
  },
  {
    symptom: 'littleInterestOrPleasure',
    symptomLabel: 'Little interest or pleasure in doing things',
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
] as const;