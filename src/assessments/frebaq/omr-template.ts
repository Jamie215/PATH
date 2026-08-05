/**
 * FreBAQ optical-mark answer-sheet template. Six statement items, each a 0–4
 * ordinal scale. Statements are long but the item column is kept narrow so the
 * answer columns can carry their word labels (Never…Always) directly under
 * each bubble, no decode legend needed.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { personalizeFreBAQItem } from './area';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const FREBAQ_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'frebaq-v1',
  title: 'Body Awareness',
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
  // The printed sheet is blank (no area yet), so render each item's neutral
  // default ("The area feels…") rather than the raw template placeholders.
  items: QUESTIONS.map((q) => ({
    key: `${q.symptom}_exp`,
    label: personalizeFreBAQItem(q.symptomLabel, ''),
    description: q.description,
  })),
  // Wider answer columns (narrower statement column) so the word labels fit.
  colSpacing: 46,
  // Positioned so the section stack (preamble + fill-in blank + heading +
  // column labels) opens the same distance below the name/date line as every
  // other form — the shared header→grid gap. This form has the tallest header
  // (a three-line instruction set) and a preamble with a fill-in blank, so its
  // grid starts lowest; rows stay tight enough that the comment box still fits
  // below the grid on the same page (statements are at most three lines).
  firstRowY: 408,
  // Tightened from 48 so the lower grid — and the constant gap the comment box
  // now keeps below the true bottom of the last (up-to-three-line) statement —
  // still leaves the comment box on page one.
  rowSpacing: 45,
  // Regions to crop from a scan for handwriting recognition. Rects (pt,
  // top-left) must track where the generator draws these fields — see the
  // preamble blank and comment box in omr-sheet.ts.
  scanTextFields: [
    // The fill-in blank's baseline (and printed rule) sit at ~y=303–307pt, so
    // the crop must reach well below the rule to keep descenders (g, y, p, q, j)
    // — a crop stopping at the baseline clips them and "g" reads as "a". The
    // section title below doesn't start until ~y=343pt, so this stays clear of it.
    { key: 'bothersome_area', label: 'Most bothersome area', kind: 'line', rect: { x: 46, y: 287, width: 292, height: 28 } },
    { key: 'other_comments', label: 'Comments', kind: 'box', rect: { x: 54, y: 686, width: 504, height: 34 } },
  ],
});
