/**
 * Brief S-LANSS optical-mark answer-sheet template. Four items, each a simple
 * Yes/No (0/1). Short option labels sit directly under the two columns, so no
 * legend is needed; items carry their clarifying descriptions.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const BRIEFSLANSS_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'briefslanss-v1',
  title: 'Brief S-LANSS Screening',
  subtitle: 'Scannable Form',
  instructions: [
    'For each item, fill in ONE bubble — Yes or No — for the painful area, using a dark pen.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'In your painful area, do you also experience…',
  groupLabel: 'Your answer',
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => o.label),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  colSpacing: 64,
  firstRowY: 348,
  rowSpacing: 62,
});
