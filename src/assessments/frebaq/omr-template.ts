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
    'If you make a mistake writing the body area, scribble over it until it can no longer be read, then write it again.',
  ],
  sectionTitle: 'With your bothersome area in mind, how often do you experience the following?',
  preamble: 'The part of my body that has been bothering me the most is my:',
  preambleField: { key: 'bothersome_area', hint: 'e.g., right knee, left hand, neck' },
  groupLabel: '',
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
  // Regions to crop from a scan for handwriting recognition. Rects (pt,
  // top-left) must track where the generator draws these fields — see the
  // preamble blank and comment box in omr-sheet.ts.
  scanTextFields: [
    // The fill-in blank's baseline (and printed rule) sit at ~y=294–298pt, so
    // the crop must reach well below the rule to keep descenders (g, y, p, q, j)
    // — a crop stopping at the baseline clips them and "g" reads as "a". The
    // section title below doesn't start until ~y=334pt, so this stays clear of it.
    { key: 'bothersome_area', label: 'Most bothersome area', kind: 'line', rect: { x: 46, y: 278, width: 292, height: 28 } },
    { key: 'other_comments', label: 'Comments', kind: 'box', rect: { x: 52, y: 682, width: 508, height: 40 } },
  ],
});
