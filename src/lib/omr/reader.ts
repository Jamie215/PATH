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

/** Otsu's method: the grayscale level that best splits ink from paper by
 *  maximizing between-class variance. Robust to the uneven lighting of phone
 *  photos, where a single fixed threshold drifts. */
function otsuThreshold(img: GrayImage): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < img.data.length; i += 1) hist[img.data[i]] += 1;
  const total = img.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Heuristically detect a struck-out / crossed-out word in a single-line crop:
 * a long, near-horizontal ink run through the vertical middle of the writing —
 * longer than any legitimate glyph stroke (a t-crossbar or hyphen is short
 * relative to the word). Restricting the search to the central band keeps a
 * baseline rule or underline captured in the crop from tripping it.
 *
 * Best-effort and deliberately conservative: it aims to fire on an obvious
 * strikethrough and stay quiet on ordinary handwriting, so a hit routes the
 * field to the reviewer rather than silently dropping text. Diagonal "X"
 * corrections are only partially covered (their strokes are near-horizontal
 * only in part). Returns false for near-empty or tiny crops.
 */
export function detectStrikethrough(img: GrayImage): boolean {
  const { width: W, height: H, data } = img;
  if (W < 12 || H < 6) return false;

  const threshold = otsuThreshold(img);
  const ink = new Uint8Array(W * H);
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[y * W + x] <= threshold) {
        ink[y * W + x] = 1;
        count += 1;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (count === 0 || x1 < x0 || y1 < y0) return false;
  const inkW = x1 - x0 + 1;
  const inkH = y1 - y0 + 1;
  if (inkW < 12 || inkH < 6) return false; // too little to judge

  // Scan only the central vertical band, so a printed rule at the baseline (or
  // a guide line at the top) can't masquerade as a strike.
  const bandTop = y0 + Math.floor(inkH * 0.2);
  const bandBot = y0 + Math.ceil(inkH * 0.8);
  let bestRun = 0;
  for (let y = bandTop; y <= bandBot; y += 1) {
    let run = 0;
    for (let x = x0; x <= x1; x += 1) {
      // Dilate one row vertically so a slightly slanted strike still reads as
      // one continuous run — but stay inside the band, so a rule just below it
      // (an underline at the baseline) isn't pulled in.
      const on =
        ink[y * W + x] ||
        (y - 1 >= bandTop && ink[(y - 1) * W + x]) ||
        (y + 1 <= bandBot && ink[(y + 1) * W + x]);
      if (on) {
        run += 1;
        if (run > bestRun) bestRun = run;
      } else {
        run = 0;
      }
    }
  }

  // A strike spans most of the word (fraction of ink width) and is long
  // relative to the line height (absolute), which short glyph strokes are not.
  return bestRun >= inkW * 0.6 && bestRun >= inkH * 2.0;
}

/**
 * Remove a printed horizontal rule (the fill-in blank's underline) from a
 * single-line crop before OCR, so the recognizer doesn't read the line as an
 * extra stroke that merges letters or trails as a dash.
 *
 * Finds a thin band, in the lower part of the crop, whose rows are one long
 * continuous horizontal ink run, then clears only the rule pixels that are NOT
 * crossed by a vertical stroke: a descender (g, y, p, q, j) passing through
 * the line has ink both above and below the band and is preserved, while the
 * bare rule (and the stretch of it between and beyond letters) is erased.
 *
 * Returns a cleaned copy; the input is untouched. Conservative — if no
 * rule-like band is found it returns an unchanged copy.
 */
export function removeHorizontalRule(img: GrayImage): GrayImage {
  const { width: W, height: H, data } = img;
  const out = new Uint8Array(data); // work on a copy; never mutate the input
  const result: GrayImage = { width: W, height: H, data: out };
  if (W < 12 || H < 8) return result;

  const threshold = otsuThreshold(img);
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < data.length; i += 1) if (data[i] <= threshold) ink[i] = 1;

  // A rule row is one long horizontal run spanning most of the crop width.
  const minRun = Math.round(W * 0.5);
  const isRuleRow = new Uint8Array(H);
  for (let y = 0; y < H; y += 1) {
    let run = 0;
    let best = 0;
    for (let x = 0; x < W; x += 1) {
      if (ink[y * W + x]) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    if (best >= minRun) isRuleRow[y] = 1;
  }

  const maxThick = Math.max(2, Math.round(H * 0.12));
  const supportGap = Math.max(2, Math.round(H * 0.1));

  let y = 0;
  while (y < H) {
    if (!isRuleRow[y]) {
      y += 1;
      continue;
    }
    const r0 = y;
    let r1 = y;
    while (r1 + 1 < H && isRuleRow[r1 + 1]) r1 += 1;
    const center = (r0 + r1) / 2;
    // A printed rule is thin and sits at/below the baseline (lower part of the
    // crop). Skip thick bands (dense text) or high ones (a strikethrough).
    if (r1 - r0 + 1 <= maxThick && center >= H * 0.45) {
      for (let x = 0; x < W; x += 1) {
        let above = false;
        for (let k = 1; k <= supportGap && r0 - k >= 0; k += 1) {
          if (ink[(r0 - k) * W + x]) {
            above = true;
            break;
          }
        }
        let below = false;
        for (let k = 1; k <= supportGap && r1 + k < H; k += 1) {
          if (ink[(r1 + k) * W + x]) {
            below = true;
            break;
          }
        }
        if (above && below) continue; // a stroke crosses the line here — keep it
        for (let ry = r0; ry <= r1; ry += 1) {
          if (ink[ry * W + x]) out[ry * W + x] = 255; // erase the bare rule
        }
      }
    }
    y = r1 + 1;
  }

  return result;
}

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
