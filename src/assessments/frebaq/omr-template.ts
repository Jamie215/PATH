/**
 * FreBAQ optical-mark answer-sheet template. Six statement items, each a 0–4
 * ordinal scale. Statements are long, so the item column is wide and wraps;
 * the 0–4 columns are headed by value with a decode legend.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const FREBAQ_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'frebaq-v1',
  title: 'Fremantle Back Awareness Questionnaire',
  subtitle: 'Paper answer sheet',
  instructions: [
    'Each statement is about your back (the affected area). Fill in ONE bubble for how often each is true, using a dark pen.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'How often is each statement true?',
  groupLabel: 'How often?',
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => String(o.value)),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [EXPERIENCE_OPTIONS.map((o) => `${o.value} = ${o.label}`).join('     ')],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  colSpacing: 36,
  firstRowY: 350,
  rowSpacing: 52,
});
