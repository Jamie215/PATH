/**
 * Core types for the OMR reader.
 *
 * The reader is deliberately DOM-free: every algorithm operates on a plain
 * `GrayImage` (one luminance byte per pixel), so the whole pipeline —
 * fiducial detection, perspective correction, bubble sampling, decision —
 * runs and unit-tests headlessly in Node. A thin browser shim (elsewhere)
 * decodes an uploaded File into a `GrayImage`; nothing here touches a canvas.
 */

/** Grayscale image: `data[y * width + x]` is luminance 0 (black) … 255 (white). */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** 2D point in pixel space (origin top-left). */
export interface Pt {
  x: number;
  y: number;
}

/** Row-major 3×3 homography matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Outcome of decoding one response field (a row-group of bubbles). */
export interface FieldRead {
  /** Response key the scorer expects, e.g. `sharp_freq`. */
  key: string;
  /** Chosen value, or null when the field reads blank / too ambiguous to call. */
  value: number | null;
  /** Per-bubble interior darkness, 0 (empty) … 1 (fully filled), option order. */
  darknesses: number[];
  /** 0 … 1 confidence in `value` (absolute fill and margin over runner-up). */
  confidence: number;
  status: 'ok' | 'blank' | 'ambiguous';
}

/** Full result of reading one sheet. */
export interface OmrReadResult {
  /** True when the sheet was located (fiducials found) and sampled. */
  ok: boolean;
  /** Present only when `ok` is false — why detection failed. */
  error?: string;
  /** Structured response for the scorer (blank/ignored fields omitted). */
  response: Record<string, number>;
  /** Per-field diagnostics, in template order. */
  fields: FieldRead[];
  /** The flattened, deskewed sheet — for the confirmation UI to display. */
  warped?: GrayImage;
  /** Non-fatal notes (e.g. low-confidence or missing required fields). */
  warnings: string[];
}
