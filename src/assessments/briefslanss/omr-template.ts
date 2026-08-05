/**
 * Brief S-LANSS optical-mark answer-sheet template. Four items, each a simple
 * Yes/No (0/1). Short option labels sit directly under the two columns, so no
 * legend is needed; items carry their clarifying descriptions.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const BRIEFSLANSS_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'briefslanss-v1',
  title: 'Sensory Profile',
  subtitle: 'Scannable Form',
  instructions: [
    'For each item, fill in ONE bubble — Yes or No — for the painful area.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'In your painful area, do you also experience…',
  groupLabel: '',
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => o.label),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  colSpacing: 64,
  // Positioned so the section heading opens the same distance below the
  // name/date line as every other form — the shared header→grid gap. No
  // preamble and single-line column labels, so its grid starts highest.
  firstRowY: 323,
  rowSpacing: 62,
  // Comment box region (pt, top-left) to crop from a scan for handwriting
  // recognition — tracks where the generator draws the box below the grid.
  scanTextFields: [
    { key: 'other_comments', label: 'Comments', kind: 'box', rect: { x: 54, y: 568, width: 504, height: 48 } },
  ],
});
