/**
 * MSI optical-mark answer-sheet template.
 *
 * Produces a fully-resolved `OmrTemplate` (explicit normalized coordinates
 * for every bubble and fiducial) so the sheet generator and the future
 * reader share one geometry. The layout is authored here in PostScript
 * points on US Letter, then normalized on the way out.
 *
 * One symptom per row, with two bubble groups side by side. The group
 * headers and per-column word labels deliberately mirror the on-screen
 * survey's wording ("How often do you experience it?" → Never/Rarely/
 * Often/Always; "When it occurs, how bothersome is it?" → Barely/Somewhat/
 * Quite/Extremely) so a respondent reads the sheet as the same questions,
 * not an abstract grid.
 *
 * Bothersomeness is printed for every row unconditionally (paper can't
 * branch); the scorer already ignores interference where freq = 0, so a
 * respondent leaving it blank when they marked "Never" is correct.
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

/** Bubble columns. Pushed right and spread wide so the grid text can be
 *  larger while the long symptom labels still clear the first column and the
 *  rightmost label stays inside the margin — all on one page.
 *  Frequency group: four columns. */
const FREQ_X = [276, 313, 350, 387];
/** Bothersomeness group: four columns, after a wider inter-group gap so the
 *  last frequency column and the first bothersomeness column never read as
 *  one run. */
const INT_X = [432, 469, 506, 543];

/** First row's bubble center, and spacing between successive rows.
 *  Generous spacing: the grid sits below a taller header and spreads down
 *  the page so every row has room to breathe. */
const FIRST_ROW_Y = 336;
const ROW_SPACING = 42;

const BUBBLE_RADIUS_PT = 6.5;
const FIDUCIAL_SIZE_PT = 16;
/** Fiducial center inset from each page edge. */
const FIDUCIAL_INSET = 30;

/** Short clarifications for the two symptoms the survey elaborates on. */
const DESCRIPTIONS: Partial<Record<(typeof SYMPTOMS)[number], string>> = {
  sensitive: 'Bothered by certain light, noise, odor, or temperature',
  foggy: 'Difficulty concentrating or remembering things',
};

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
    return {
      label: SYMPTOM_LABELS[symptom],
      description: DESCRIPTIONS[symptom],
      fields: [freq, interference],
    };
  });
}

/** Column headers use the first word of each option label — full enough to
 *  read, short enough to sit under a bubble (e.g. "Extremely Bothersome"
 *  → "Extremely"). */
const shortLabel = (label: string): string => label.split(' ')[0];

const FREQ_GROUP: OmrColumnGroup = {
  label: 'How OFTEN do you feel it?',
  optionHeaders: FREQUENCY_OPTIONS.map((o) => shortLabel(o.label)),
  columnX: FREQ_X.map(nx),
};

const INT_GROUP: OmrColumnGroup = {
  label: 'How BOTHERSOME is it?',
  optionHeaders: INTERFERENCE_OPTIONS.map((o) => shortLabel(o.label)),
  columnX: INT_X.map(nx),
};

export const MSI_OMR_TEMPLATE: OmrTemplate = {
  id: 'msi-v1',
  title: 'Multi-Dimensional Symptom Index',
  subtitle: 'Paper answer sheet',
  instructions: [
    'For each symptom, fill in ONE bubble for how OFTEN you experience it, using a dark pen.',
    'If it occurs (more than "Never"), also fill in ONE bubble for how BOTHERSOME it is.',
    'Consider only symptoms you believe are due to the condition you are seeking treatment for.',
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
  orientationMark: {
    // Inset diagonally from the bottom-left corner — empty space clear of
    // any header/footer text, adjacent to exactly one fiducial so the reader
    // can name that corner and recover the sheet's orientation.
    center: { x: nx(FIDUCIAL_INSET + 24), y: ny(PAGE_H - FIDUCIAL_INSET - 24) },
    size: nx(8),
  },
  sections: [
    {
      title: 'Symptoms',
      legend: [],
      columnGroups: [FREQ_GROUP, INT_GROUP],
      rows: buildRows(),
    },
  ],
};
