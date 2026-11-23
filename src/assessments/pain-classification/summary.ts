/**
 * Readable answer summaries for the patient review view.
 *
 * Turns each child assessment's stored survey `:response` (keyed by field key,
 * with numeric answers) into human-readable question → answer rows, using the
 * same question text and option labels the on-screen surveys show. This backs
 * the patient's score-free review: they see exactly what they answered, not a
 * score or classification.
 */
import { get as storeGet, keys } from '../../lib/storage';
import { QUESTIONS as MSI_QUESTIONS, FREQUENCY_OPTIONS, INTERFERENCE_OPTIONS } from '../msi/questions';
import { findScreener } from '../screeners';

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
  return storeGet<Record<string, unknown>>(keys.response(slug)) ?? {};
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

  // Every screener: its items in order, worded around the area when it has one.
  const screener = findScreener(slug);
  if (screener) {
    const area = screener.areaField ? stringField(r, 'bothersome_area') : null;
    const rows = screener.questions.map((q): SummaryRow => ({
      question: screener.areaField ? screener.areaField.personalize(q.symptomLabel, area ?? '') : q.symptomLabel,
      answer: labelFor(screener.options, r[`${q.symptom}_exp`]),
    }));
    return { area, rows, comments };
  }

  return { area: null, rows: [], comments };
}
