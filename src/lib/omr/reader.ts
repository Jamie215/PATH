/**
 * Top-level OMR read: turn a photographed answer sheet into a structured
 * response the scorer can consume, plus per-field diagnostics and a flattened
 * image for the confirmation UI.
 *
 * Pipeline: detect + label corners → homography (canonical → photo) → warp the
 * sheet flat → sample each bubble's interior darkness → decide each field.
 *
 * A human always confirms the result downstream, so the decision step aims to
 * pre-fill confidently-marked bubbles and *flag* anything blank or ambiguous
 * rather than guess silently. Thresholds are first-pass defaults to be tuned
 * against real photographed sheets.
 */
import type { GrayImage, Mat3, Pt, FieldRead, OmrReadResult, OmrTextCrop } from './types';
import type { OmrTemplate, OmrField } from '../../assessments/omr/types';
import { homographyFromPoints } from './geometry';
import { warpPerspective, discDarkness, annulusDarkness } from './image';
import { detectCorners } from './detect';

/** Canonical (flattened) resolution = page points × this. */
const SCALE = 2;
/** Sample the inner disc only, to exclude the printed bubble outline. */
const INNER_RADIUS_FACTOR = 0.6;
/** Local-background annulus (× bubble radius): clean paper just outside the
 *  printed ring, before the neighboring bubbles/separators. Its darkness is
 *  subtracted from the interior so paper tint and shadow cancel out. */
const BG_INNER_FACTOR = 1.35;
const BG_OUTER_FACTOR = 1.9;
/** Fill signal (interior minus local paper) needed to count as marked. Kept
 *  forgiving so a firm partial mark counts, not only an edge-to-edge fill. */
const MARK_MIN = 0.18;
/** Minimum fill margin over the runner-up for an unambiguous pick. */
const SEP_MIN = 0.12;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

function decodeField(field: OmrField, darknesses: number[]): FieldRead {
  // Every bubble whose fill signal clears the bar counts as a mark.
  const marked: number[] = [];
  for (let i = 0; i < darknesses.length; i += 1) if (darknesses[i] >= MARK_MIN) marked.push(i);

  if (marked.length === 0) {
    const maxD = Math.max(...darknesses);
    return { key: field.key, value: null, darknesses, confidence: clamp01((MARK_MIN - maxD) / MARK_MIN), status: 'blank' };
  }
  if (marked.length > 1) {
    // Two or more bubbles marked — e.g. a double-fill, or an answer that was
    // crossed out (still inked) next to the intended one. Don't pick a winner;
    // leave it unresolved so the user chooses during review.
    return { key: field.key, value: null, darknesses, confidence: 0, status: 'ambiguous' };
  }
  const mi = marked[0];
  let second = 0;
  for (let i = 0; i < darknesses.length; i += 1) if (i !== mi && darknesses[i] > second) second = darknesses[i];
  const absConf = clamp01((darknesses[mi] - MARK_MIN) / (1 - MARK_MIN));
  const sepConf = clamp01((darknesses[mi] - second) / SEP_MIN);
  const confidence = clamp01(0.4 * absConf + 0.6 * sepConf);
  return { key: field.key, value: field.bubbles[mi].value, darknesses, confidence, status: 'ok' };
}

/** Read a photographed sheet against its template. */
export function readSheet(img: GrayImage, template: OmrTemplate): OmrReadResult {
  const corners = detectCorners(img, template);
  if (!corners) {
    return { ok: false, error: 'Could not locate the sheet (corner marks not found).', response: {}, fields: [], warnings: [], attention: [] };
  }

  const canonW = Math.round(template.page.width * SCALE);
  const canonH = Math.round(template.page.height * SCALE);

  // Correspondence: template fiducial centers (canonical px) → detected photo px.
  const src: Pt[] = template.fiducials.map((f) => ({ x: f.x * canonW, y: f.y * canonH }));
  const dst: Pt[] = [corners.TL, corners.TR, corners.BR, corners.BL];
  const H: Mat3 | null = homographyFromPoints(src, dst);
  if (!H) {
    return { ok: false, error: 'Corner marks are degenerate; cannot rectify the sheet.', response: {}, fields: [], warnings: [], attention: [] };
  }

  const warped = warpPerspective(img, H, canonW, canonH);
  const fullR = template.bubbleRadius * canonW;
  const sampleR = fullR * INNER_RADIUS_FACTOR;
  const bgInner = fullR * BG_INNER_FACTOR;
  const bgOuter = fullR * BG_OUTER_FACTOR;

  const fields: FieldRead[] = [];
  const response: Record<string, number> = {};
  const warnings: string[] = [];
  const attention: string[] = [];

  for (const section of template.sections) {
    for (const row of section.rows) {
      const rowReads: FieldRead[] = row.fields.map((field) => {
        // Fill signal = interior darkness minus the local paper background,
        // so shadow and off-white paper don't masquerade as ink.
        const darknesses = field.bubbles.map((b) => {
          const cx = b.center.x * canonW;
          const cy = b.center.y * canonH;
          const interior = discDarkness(warped, cx, cy, sampleR);
          const background = annulusDarkness(warped, cx, cy, bgInner, bgOuter);
          return Math.max(0, interior - background);
        });
        const read = decodeField(field, darknesses);
        fields.push(read);
        return read;
      });
      assembleRow(row.label, rowReads, response, warnings, attention);
    }
  }

  const textCrops = cropTextFields(warped, template, canonW, canonH);

  return { ok: true, response, fields, warped, textCrops, warnings, attention };
}

/** Extract a rectangular sub-image (pixel coords), clamped to bounds. */
function cropGray(img: GrayImage, x: number, y: number, w: number, h: number): GrayImage {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(img.width, Math.round(x + w));
  const y1 = Math.min(img.height, Math.round(y + h));
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  const data = new Uint8Array(cw * ch);
  for (let row = 0; row < ch; row += 1) {
    const src = (y0 + row) * img.width + x0;
    data.set(img.data.subarray(src, src + cw), row * cw);
  }
  return { width: cw, height: ch, data };
}

/** Fraction of clearly-dark pixels (ink) in a grayscale image. */
function inkFraction(img: GrayImage): number {
  if (img.data.length === 0) return 0;
  let dark = 0;
  for (let i = 0; i < img.data.length; i += 1) if (img.data[i] < 110) dark += 1;
  return dark / img.data.length;
}

/** Above this fraction of dark pixels, a region is treated as written-in.
 *  Kept low so a light pen still trips it; the cost of a false positive is
 *  only that the reviewer is asked to confirm an empty field. */
const INK_MIN_FRACTION = 0.006;

/** Crop each declared free-text region from the flattened sheet, flagging
 *  which ones appear to have handwriting in them. */
function cropTextFields(
  warped: GrayImage,
  template: OmrTemplate,
  canonW: number,
  canonH: number,
): OmrTextCrop[] {
  return (template.scanTextFields ?? []).map((f) => {
    const image = cropGray(
      warped,
      f.rect.x * canonW,
      f.rect.y * canonH,
      f.rect.width * canonW,
      f.rect.height * canonH,
    );
    return {
      key: f.key,
      label: f.label,
      kind: f.kind,
      image,
      hasInk: inkFraction(image) >= INK_MIN_FRACTION,
    };
  });
}

/**
 * Fold a row's decoded fields into the response, honoring MSI's conditional
 * follow-up: an `*_interference` field is only meaningful when its sibling
 * `*_freq` is > 0. Rows without that pairing (the shorter assessments) just
 * take each present value. Missing required values become warnings — the
 * confirmation UI resolves them.
 *
 * Exported so every ingest channel — the scan reader here and the PDF-form
 * reader — turns per-field reads into the same response/warnings/attention,
 * regardless of how each field's value was obtained.
 */
export function assembleRow(
  label: string,
  reads: FieldRead[],
  response: Record<string, number>,
  warnings: string[],
  attention: string[],
): void {
  const freq = reads.find((r) => r.key.endsWith('_freq'));
  const interference = reads.find((r) => r.key.endsWith('_interference'));

  if (freq && interference) {
    if (freq.value === null) {
      warnings.push(
        freq.status === 'ambiguous'
          ? `"${label}": more than one frequency bubble marked — please choose one.`
          : `"${label}": frequency not marked.`,
      );
      attention.push(freq.key);
      return; // nothing usable without a single frequency
    }
    response[freq.key] = freq.value;
    if (freq.value === 0) return; // "Never" → bothersomeness ignored by design
    if (interference.value === null) {
      warnings.push(
        interference.status === 'ambiguous'
          ? `"${label}": more than one bothersomeness bubble marked — please choose one.`
          : `"${label}": marked as occurring, but bothersomeness not marked.`,
      );
      attention.push(interference.key);
    } else {
      response[interference.key] = interference.value;
    }
    return;
  }

  // Generic single-value rows.
  for (const r of reads) {
    if (r.value === null) {
      warnings.push(
        r.status === 'ambiguous'
          ? `"${label}": more than one bubble marked — please choose one.`
          : `"${label}": not marked.`,
      );
      attention.push(r.key);
    } else {
      response[r.key] = r.value;
    }
  }
}
