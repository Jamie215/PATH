/**
 * Shared types for OMR (optical mark recognition) answer sheets.
 *
 * An `OmrTemplate` is the *single source of truth* for one assessment's
 * paper answer sheet. It is consumed by two sides that must never drift
 * apart:
 *
 *   1. the sheet generator (`src/lib/omr-sheet.ts`), which renders a blank
 *      printable PDF from it, and
 *   2. the reader (later phase), which — after detecting the sheet's four
 *      corner fiducials and warping the photo flat — samples ink density at
 *      each bubble's coordinate to recover the marked value.
 *
 * Because both sides read the *same* bubble coordinates, moving a bubble
 * updates the print and the read together.
 *
 * Coordinate system: every point is in **normalized page coordinates** —
 * `x` and `y` each in `[0, 1]`, origin **top-left** (natural for images, so
 * the reader needs no Y-flip; the PDF renderer flips Y once on the way out).
 * Lengths (`bubbleRadius`, `fiducialSize`) are normalized to the page
 * *width*, so a bubble stays circular regardless of page aspect ratio.
 */

/** A point in normalized page coordinates: origin top-left, x/y in [0, 1]. */
export interface OmrPoint {
  x: number;
  y: number;
}

/** One fillable bubble and the response value it encodes when marked. */
export interface OmrBubble {
  value: number;
  center: OmrPoint;
}

/**
 * A single response field: one row of mutually-exclusive bubbles that
 * resolves to one value. `key` is the exact key the assessment's scorer
 * expects (e.g. `sharp_freq`, `sharp_interference`).
 */
export interface OmrField {
  key: string;
  bubbles: OmrBubble[];
}

/**
 * A labelled row on the sheet: a printed description plus one or more bubble
 * groups. MSI uses two groups per row (frequency + bothersomeness); the
 * shorter assessments will use one.
 */
export interface OmrRow {
  label: string;
  fields: OmrField[];
}

/** Header metadata for one column group, printed above its bubbles. */
export interface OmrColumnGroup {
  /** Group heading, e.g. 'FREQUENCY'. */
  label: string;
  /** Short per-column headers printed above each bubble, e.g. ['0','1','2','3']. */
  optionHeaders: string[];
  /** Normalized x of each column, aligned 1:1 with `optionHeaders`. */
  columnX: number[];
}

/** A block of rows sharing a heading, legend, and column layout. */
export interface OmrSection {
  title: string;
  /** Lines decoding the option headers, e.g. '0 = Never   1 = Rarely   …'. */
  legend: string[];
  columnGroups: OmrColumnGroup[];
  rows: OmrRow[];
}

/**
 * Everything needed to print — and later read — one assessment's sheet.
 * The generator draws all decorative text (titles, legends, row labels,
 * column headers) relative to the concrete bubble coordinates, so the
 * bubbles remain the only shared truth between print and read.
 */
export interface OmrTemplate {
  /** Stable form identifier printed on the sheet, e.g. 'msi-v1'. */
  id: string;
  title: string;
  subtitle: string;
  /** Fill-in instructions, one line each. */
  instructions: string[];
  /** Page size in PostScript points (US Letter = 612 × 792). */
  page: { width: number; height: number };
  /** Bubble radius, normalized to page width. */
  bubbleRadius: number;
  /** Exactly four corner registration marks, in TL, TR, BR, BL order. */
  fiducials: [OmrPoint, OmrPoint, OmrPoint, OmrPoint];
  /** Side length of each square fiducial, normalized to page width. */
  fiducialSize: number;
  sections: OmrSection[];
}
