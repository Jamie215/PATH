/**
 * PHQ-4 optical-mark answer-sheet template. Four items, each a 0–3 ordinal
 * scale. The option labels ("More than half the days") are long, so the item
 * column is narrowed and the answer columns widened, letting each label wrap
 * onto a few lines directly under its bubble instead of needing a decode
 * legend.
 */
import { QUESTIONS, EXPERIENCE_OPTIONS } from './questions';
import { buildSingleGroupTemplate } from '../omr/single-group-template';

export const PHQ4_OMR_TEMPLATE = buildSingleGroupTemplate({
  id: 'phq4-v1',
  title: 'Anxiety & Depression',
  subtitle: 'Scannable Form',
  instructions: [
    'For each item, fill in ONE bubble for how often it has bothered you over the last 2 weeks, using a dark pen.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  sectionTitle: 'Over the last 2 weeks, how often have you been bothered by the following?',
  groupLabel: '',
  // Word labels sit (wrapped) under each bubble as a self-describing radio
  // group, replacing the 0–3 decode legend the long labels used to need.
  optionHeaders: EXPERIENCE_OPTIONS.map((o) => o.label),
  optionValues: EXPERIENCE_OPTIONS.map((o) => o.value),
  legend: [],
  items: QUESTIONS.map((q) => ({ key: `${q.symptom}_exp`, label: q.symptomLabel, description: q.description })),
  // Wider answer columns (narrower statement column) so the multi-word labels
  // wrap tidily under each bubble instead of overflowing.
  colSpacing: 56,
  // Positioned so the section stack (heading + wrapped column labels) opens the
  // same distance below the name/date line as every other form — the shared
  // ~32pt header→grid gap (matches BriefSLANSS). With no preamble, the stack
  // above the grid is just the title and the three-line wrapped column labels,
  // so the grid sits higher than the preamble'd forms. The four short items
  // leave plenty of room below.
  firstRowY: 335,
  rowSpacing: 46,
  // Comment box region (pt, top-left) to crop from a scan for handwriting
  // recognition — tracks where the generator draws the box below the grid, so
  // it moves up in lockstep with firstRowY.
  scanTextFields: [
    { key: 'other_comments', label: 'Comments', kind: 'box', rect: { x: 54, y: 513, width: 504, height: 48 } },
  ],
});
