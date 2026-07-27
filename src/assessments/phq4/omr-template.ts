/**
 * PHQ-4 optical-mark answer-sheet template. Four items, each a 0–3 ordinal
 * scale. The option labels ("More than half the days") are too long to sit
 * under a bubble, so columns are headed by their value with a decode legend.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const PHQ4_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'phq4-v1',
  title: 'Patient Health Questionnaire-4',
  subtitle: 'Scannable Form',
  instructions: [
    'For each item, fill in ONE bubble for how often it has bothered you over the last 2 weeks, using a dark pen.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'Over the last 2 weeks, how often have you been bothered by the following?',
  preamble:
    "These four questions ask about your mood more generally and how you've been feeling recently, whether due to pain or something else.",
  groupLabel: 'How often?',
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => String(o.value)),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [EXPERIENCE_OPTIONS.map((o) => `${o.value} = ${o.label}`).join('     ')],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  colSpacing: 44,
  firstRowY: 375,
  rowSpacing: 46,
});
