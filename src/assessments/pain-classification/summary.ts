/**
 * Readable answer summaries for the patient review view.
 *
 * Turns each child assessment's stored survey `:response` (keyed by field key,
 * with numeric answers) into human-readable question → answer rows, using the
 * same question text and option labels the on-screen surveys show. This backs
 * the patient's score-free review: they see exactly what they answered, not a
 * score or classification.
 */
import { get as storeGet } from '../../lib/storage';
import { QUESTIONS as MSI_QUESTIONS, FREQUENCY_OPTIONS, INTERFERENCE_OPTIONS } from '../msi/questions';
import { QUESTIONS as SLANSS_QUESTIONS, EXPERIENCE_OPTIONS as SLANSS_OPTIONS } from '../briefslanss/questions';
import { QUESTIONS as FREBAQ_QUESTIONS, EXPERIENCE_OPTIONS as FREBAQ_OPTIONS } from '../frebaq/questions';
import { personalizeFreBAQItem } from '../frebaq/area';
import { QUESTIONS as PHQ4_QUESTIONS, EXPERIENCE_OPTIONS as PHQ4_OPTIONS } from '../phq4/questions';

export interface SummaryRow {
  question: string;
  /** The chosen option's label, or null if the item was left unanswered. */
  answer: string | null;
}

export interface ChildSummary {
  /** Free-text bothersome area (FreBAQ only). */
  area: string | null;
  rows: SummaryRow[];
  /** Free-text comment the respondent added, if any. */
  comments: string | null;
}

type Option = { value: number; label: string };

function labelFor(options: readonly Option[], value: unknown): string | null {
  if (typeof value !== 'number') return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

function readResponse(slug: string): Record<string, unknown> {
  return storeGet<Record<string, unknown>>(`${slug}:response`) ?? {};
}

function stringField(response: Record<string, unknown>, key: string): string | null {
  const v = response[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** Build the readable question/answer summary for one child assessment. */
export function summarizeChild(slug: string): ChildSummary {
  const r = readResponse(slug);
  const comments = stringField(r, 'other_comments');

  if (slug === 'msi') {
    const rows = MSI_QUESTIONS.map((q): SummaryRow => {
      const freq = r[`${q.symptom}_freq`];
      const freqLabel = labelFor(FREQUENCY_OPTIONS, freq);
      // Bothersomeness is only asked when the symptom occurs (freq > 0).
      if (typeof freq === 'number' && freq > 0) {
        const intLabel = labelFor(INTERFERENCE_OPTIONS, r[`${q.symptom}_interference`]);
        return { question: q.symptomLabel, answer: intLabel ? `${freqLabel} · ${intLabel}` : freqLabel };
      }
      return { question: q.symptomLabel, answer: freqLabel };
    });
    return { area: null, rows, comments };
  }

  if (slug === 'briefslanss') {
    const rows = SLANSS_QUESTIONS.map((q): SummaryRow => ({
      question: q.symptomLabel,
      answer: labelFor(SLANSS_OPTIONS, r[`${q.symptom}_exp`]),
    }));
    return { area: null, rows, comments };
  }

  if (slug === 'frebaq') {
    const area = stringField(r, 'bothersome_area');
    const rows = FREBAQ_QUESTIONS.map((q): SummaryRow => ({
      question: personalizeFreBAQItem(q.symptomLabel, area ?? ''),
      answer: labelFor(FREBAQ_OPTIONS, r[`${q.symptom}_exp`]),
    }));
    return { area, rows, comments };
  }

  if (slug === 'phq4') {
    const rows = PHQ4_QUESTIONS.map((q): SummaryRow => ({
      question: q.symptomLabel,
      answer: labelFor(PHQ4_OPTIONS, r[`${q.symptom}_exp`]),
    }));
    return { area: null, rows, comments };
  }

  return { area: null, rows: [], comments };
}
