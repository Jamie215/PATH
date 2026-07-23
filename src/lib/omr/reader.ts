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
import type { GrayImage, Mat3, Pt, FieldRead, OmrReadResult } from './types';
import type { OmrTemplate, OmrField } from '../../assessments/omr/types';
import { homographyFromPoints } from './geometry';
import { warpPerspective, discDarkness } from './image';
import { detectCorners } from './detect';

/** Canonical (flattened) resolution = page points × this. */
const SCALE = 2;
/** Sample the inner disc only, to exclude the printed bubble outline. */
const INNER_RADIUS_FACTOR = 0.6;
/** A bubble counts as marked when its interior darkness reaches this. */
const MARK_MIN = 0.35;
/** Minimum darkness margin over the runner-up for an unambiguous pick. */
const SEP_MIN = 0.15;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

function decodeField(field: OmrField, darknesses: number[]): FieldRead {
  let mi = 0;
  for (let i = 1; i < darknesses.length; i += 1) if (darknesses[i] > darknesses[mi]) mi = i;
  const maxD = darknesses[mi];
  let second = -1;
  for (let i = 0; i < darknesses.length; i += 1) if (i !== mi && darknesses[i] > second) second = darknesses[i];
  const gap = maxD - second;

  if (maxD < MARK_MIN) {
    return { key: field.key, value: null, darknesses, confidence: clamp01((MARK_MIN - maxD) / MARK_MIN), status: 'blank' };
  }
  const absConf = clamp01((maxD - MARK_MIN) / (1 - MARK_MIN));
  const sepConf = clamp01(gap / SEP_MIN);
  const confidence = clamp01(0.4 * absConf + 0.6 * sepConf);
  const status: FieldRead['status'] = gap < SEP_MIN ? 'ambiguous' : 'ok';
  return { key: field.key, value: field.bubbles[mi].value, darknesses, confidence, status };
}

/** Read a photographed sheet against its template. */
export function readSheet(img: GrayImage, template: OmrTemplate): OmrReadResult {
  const corners = detectCorners(img, template);
  if (!corners) {
    return { ok: false, error: 'Could not locate the sheet (corner marks not found).', response: {}, fields: [], warnings: [] };
  }

  const canonW = Math.round(template.page.width * SCALE);
  const canonH = Math.round(template.page.height * SCALE);

  // Correspondence: template fiducial centers (canonical px) → detected photo px.
  const src: Pt[] = template.fiducials.map((f) => ({ x: f.x * canonW, y: f.y * canonH }));
  const dst: Pt[] = [corners.TL, corners.TR, corners.BR, corners.BL];
  const H: Mat3 | null = homographyFromPoints(src, dst);
  if (!H) {
    return { ok: false, error: 'Corner marks are degenerate; cannot rectify the sheet.', response: {}, fields: [], warnings: [] };
  }

  const warped = warpPerspective(img, H, canonW, canonH);
  const sampleR = template.bubbleRadius * canonW * INNER_RADIUS_FACTOR;

  const fields: FieldRead[] = [];
  const response: Record<string, number> = {};
  const warnings: string[] = [];

  for (const section of template.sections) {
    for (const row of section.rows) {
      const rowReads: FieldRead[] = row.fields.map((field) => {
        const darknesses = field.bubbles.map((b) =>
          discDarkness(warped, b.center.x * canonW, b.center.y * canonH, sampleR),
        );
        const read = decodeField(field, darknesses);
        fields.push(read);
        return read;
      });
      assembleRow(row.label, rowReads, response, warnings);
    }
  }

  return { ok: true, response, fields, warped, warnings };
}

/**
 * Fold a row's decoded fields into the response, honoring MSI's conditional
 * follow-up: an `*_interference` field is only meaningful when its sibling
 * `*_freq` is > 0. Rows without that pairing (the shorter assessments) just
 * take each present value. Missing required values become warnings — the
 * confirmation UI resolves them.
 */
function assembleRow(
  label: string,
  reads: FieldRead[],
  response: Record<string, number>,
  warnings: string[],
): void {
  const freq = reads.find((r) => r.key.endsWith('_freq'));
  const interference = reads.find((r) => r.key.endsWith('_interference'));

  if (freq && interference) {
    if (freq.value === null) {
      warnings.push(`"${label}": frequency not marked.`);
      return; // interference is meaningless without frequency
    }
    response[freq.key] = freq.value;
    if (freq.value === 0) return; // "Never" → bothersomeness ignored by design
    if (interference.value === null) {
      warnings.push(`"${label}": marked as occurring, but bothersomeness not marked.`);
    } else {
      response[interference.key] = interference.value;
    }
    return;
  }

  // Generic single-value rows.
  for (const r of reads) {
    if (r.value === null) warnings.push(`"${label}": not marked.`);
    else response[r.key] = r.value;
  }
}
