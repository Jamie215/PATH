/**
 * MSI optical-mark answer-sheet template.
 *
 * Produces a fully-resolved `OmrTemplate` (explicit normalized coordinates
 * for every bubble and fiducial) so the sheet generator and the future
 * reader share one geometry. The layout is authored here in PostScript
 * points on US Letter, then normalized on the way out.
 *
 * One symptom per row, with two bubble groups side by side — frequency
 * (0–3) and bothersomeness/interference (1–4) — mirroring the on-screen
 * pairing. Bothersomeness is printed for every row unconditionally (paper
 * can't branch); the scorer already ignores interference where freq = 0,
 * so a respondent leaving it blank when they marked "Never" is correct.
 */
import { SYMPTOMS, SYMPTOM_LABELS } from './scoring';
import { FREQUENCY_OPTIONS, INTERFERENCE_OPTIONS } from './questions';
import type {
  OmrTemplate,
  OmrRow,
  OmrField,
  OmrBubble,
  OmrColumnGroup,
} from '../omr/types';

// --- Page + layout constants (US Letter, PostScript points) -----------------

const PAGE_W = 612;
const PAGE_H = 792;

/** Label column: symptom name sits here, bubbles begin to its right. */
const LABEL_LEFT = 50;

/** Frequency group: four bubble columns. */
const FREQ_X = [260, 292, 324, 356];
/** Bothersomeness group: four bubble columns, after a wider inter-group gap
 *  so the last frequency column and the first bothersomeness column never
 *  read as one run. */
const INT_X = [404, 436, 468, 500];

/** First row's bubble center, and spacing between successive rows. */
const FIRST_ROW_Y = 245;
const ROW_SPACING = 28;

const BUBBLE_RADIUS_PT = 6;
const FIDUCIAL_SIZE_PT = 16;
/** Fiducial center inset from each page edge. */
const FIDUCIAL_INSET = 30;

// --- Normalization helpers --------------------------------------------------

const nx = (pt: number): number => pt / PAGE_W;
const ny = (pt: number): number => pt / PAGE_H;

function bubbles(columnX: number[], values: number[], rowY: number): OmrBubble[] {
  return values.map((value, i) => ({
    value,
    center: { x: nx(columnX[i]), y: ny(rowY) },
  }));
}

// --- Build -------------------------------------------------------------------

function buildRows(): OmrRow[] {
  const freqValues = FREQUENCY_OPTIONS.map((o) => o.value); // [0,1,2,3]
  const intValues = INTERFERENCE_OPTIONS.map((o) => o.value); // [1,2,3,4]

  return SYMPTOMS.map((symptom, i): OmrRow => {
    const rowY = FIRST_ROW_Y + i * ROW_SPACING;
    const freq: OmrField = {
      key: `${symptom}_freq`,
      bubbles: bubbles(FREQ_X, freqValues, rowY),
    };
    const interference: OmrField = {
      key: `${symptom}_interference`,
      bubbles: bubbles(INT_X, intValues, rowY),
    };
    return { label: SYMPTOM_LABELS[symptom], fields: [freq, interference] };
  });
}

const FREQ_GROUP: OmrColumnGroup = {
  label: 'FREQUENCY',
  optionHeaders: FREQUENCY_OPTIONS.map((o) => String(o.value)),
  columnX: FREQ_X.map(nx),
};

const INT_GROUP: OmrColumnGroup = {
  label: 'BOTHERSOMENESS',
  optionHeaders: INTERFERENCE_OPTIONS.map((o) => String(o.value)),
  columnX: INT_X.map(nx),
};

/** Legend lines decoding the numeric headers back to their word labels. */
const FREQ_LEGEND = 'Frequency:  ' + FREQUENCY_OPTIONS.map((o) => `${o.value} ${o.label}`).join('    ');
const INT_LEGEND =
  'Bothersomeness:  ' + INTERFERENCE_OPTIONS.map((o) => `${o.value} ${o.label}`).join('    ');

export const MSI_OMR_TEMPLATE: OmrTemplate = {
  id: 'msi-v1',
  title: 'Multi-Dimensional Symptom Index',
  subtitle: 'Paper answer sheet',
  instructions: [
    'Fill in ONE bubble completely per group, using a dark pen.',
    'For each symptom, mark how often you feel it (Frequency). If more than "Never", also mark how bothersome it is.',
    'To change an answer, cross out the wrong bubble with an X and fill the correct one.',
  ],
  page: { width: PAGE_W, height: PAGE_H },
  bubbleRadius: nx(BUBBLE_RADIUS_PT),
  fiducialSize: nx(FIDUCIAL_SIZE_PT),
  fiducials: [
    { x: nx(FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) }, // TL
    { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) }, // TR
    { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) }, // BR
    { x: nx(FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) }, // BL
  ],
  sections: [
    {
      title: 'Symptoms',
      legend: [FREQ_LEGEND, INT_LEGEND],
      columnGroups: [FREQ_GROUP, INT_GROUP],
      rows: buildRows(),
    },
  ],
};
