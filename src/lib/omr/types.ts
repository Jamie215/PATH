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

/** A cropped free-text region from a scan, awaiting handwriting recognition
 *  and the user's confirmation. */
export interface OmrTextCrop {
  /** Response key / AcroForm field name (e.g. `bothersome_area`). */
  key: string;
  /** Label for the confirmation UI. */
  label: string;
  kind: 'line' | 'box';
  /** The cropped grayscale image of the handwritten region. */
  image: GrayImage;
  /** Whether the region appears to have been written in (ink detected), so the
   *  confirmation UI can require the reviewer to fill it in. */
  hasInk: boolean;
}

/** Full result of reading one sheet. */
export interface OmrReadResult {
  /** True when the sheet was located (fiducials found) and sampled. */
  ok: boolean;
  /** Present only when `ok` is false — why detection failed. */
  error?: string;
  /** Structured response for the scorer (blank/ignored fields omitted). */
  response: Record<string, number>;
  /**
   * Free-text field values recovered from a filled PDF form, keyed by field
   * name (e.g. `patient_name`, `other_comments`). Absent for scans, which
   * carry no machine-read text. Empty fields are omitted.
   */
  text?: Record<string, string>;
  /** Per-field diagnostics, in template order. */
  fields: FieldRead[];
  /** The flattened, deskewed sheet — for the confirmation UI to display. */
  warped?: GrayImage;
  /** Cropped free-text regions (from `template.scanTextFields`) for handwriting
   *  recognition + confirmation. Absent for filled PDFs, which carry exact
   *  typed text instead. */
  textCrops?: OmrTextCrop[];
  /** Non-fatal notes (e.g. low-confidence or missing required fields). */
  warnings: string[];
  /**
   * Response keys that need the user's attention (blank required, contested,
   * or missing follow-up), so the confirmation UI can highlight exactly those
   * questions. Mirrors `warnings` but machine-usable.
   */
  attention: string[];
}
