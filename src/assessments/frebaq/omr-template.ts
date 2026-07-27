/**
 * FreBAQ optical-mark answer-sheet template. Six statement items, each a 0–4
 * ordinal scale. Statements are long but the item column is kept narrow so the
 * answer columns can carry their word labels (Never…Always) directly under
 * each bubble, no decode legend needed.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const FREBAQ_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'frebaq-v1',
  title: 'Fremantle Body Awareness Questionnaire',
  subtitle: 'Scannable Form',
  instructions: [
    'Each statement is about your body (the affected area). Fill in ONE bubble for how often each is true, using a dark pen.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'With your bothersome area in mind, how often do you experience the following?',
  preamble: 'The part of my body that has been bothering me the most is my:',
  preambleField: { key: 'bothersome_area', hint: 'e.g., right knee, left hand, neck' },
  groupLabel: 'How often?',
  // Word labels sit directly under each bubble (a self-describing radio group),
  // so no separate 0–4 decode legend is needed.
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => o.label),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  // Wider answer columns (narrower statement column) so the word labels fit.
  colSpacing: 46,
  // Start a little lower so the preamble and its fill-in blank clear the
  // name/date line; rows are tightened so the comment box still fits below the
  // grid on the same page (statements are at most three lines, which still fit).
  firstRowY: 400,
  rowSpacing: 48,
});
