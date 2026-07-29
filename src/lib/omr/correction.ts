/**
 * Correction-mark handling for a handwriting crop (the FreBAQ bothersome-area
 * line), run *before* OCR — "detect, drop, and read".
 *
 * The sheet instructs one correction gesture: if you miswrite the body area,
 * scribble over it until it can no longer be read. So this only has to detect a
 * scribble — a word-sized region of heavy, overlapping ink — which is a high
 * ink density (and/or many stroke-crossings for a looser scribble). We no
 * longer try to handle strike-throughs or X-outs; standardizing the gesture
 * removes the ambiguous cases that lightweight detection couldn't separate from
 * a merely bold word.
 *
 * Two things have to happen first, or nothing downstream works:
 *  - The crop includes the printed fill-in rule (and any hand-drawn underline).
 *    A full-width rule bridges every word into one segment, so it's removed
 *    before segmenting.
 *  - The intended text is whatever survives once the scribble is whitened (the
 *    replacement written beside it). We do not try to reconstruct the glyphs
 *    under the scribble — that ink is destroyed, which is the point.
 *
 * When cancels dominate the crop (nothing clean remains, or a correction
 * overlaps the intended word), we report `dominated` and the caller falls back
 * to the pinned crop for manual entry rather than feeding OCR garbage.
 *
 * DOM-free and pure: operates on a `GrayImage`, so it unit-tests headlessly.
 * Thresholds are first-pass defaults, to be calibrated against real sheets.
 */
import type { GrayImage } from './types';

export interface CorrectionResult {
  /** Crop with rules and detected correction regions whitened out. */
  image: GrayImage;
  /** A correction region was found and removed. */
  corrected: boolean;
  /** Corrections dominate — too little clean text remains to trust OCR, so the
   *  caller should flag for manual entry from the crop. */
  dominated: boolean;
}

/** A row inked across ≥ this fraction of the full crop width is a rule or
 *  underline, not content — removed before segmenting so words separate. */
const RULE_W = 0.75;
/** Column counts as inked when at least this fraction of its height is ink. */
const INK_MIN_COL = 0.04;
/** Column gaps narrower than this (× height) are within a word, so merge. */
const MERGE_GAP = 0.22;
/** Ignore ink runs narrower than this (× height) — specks, not words. */
const MIN_SEG = 0.12;
/** A cancel spans a word; a segment narrower than this (× height) is a letter
 *  or stroke, never a correction, however busy it looks on its own. */
const MIN_CORRECTION_W = 0.6;
/** Below this ink density a region is too sparse to be a scribble. */
const DENSITY_MIN = 0.2;
/** Ink density (× content box) that reads as a scribbled-out word. */
const DENSITY_HI = 0.4;
/** Mean vertical ink-runs per column that reads as a looser scribble whose
 *  strokes cross often; real cursive words measure ~2.0–2.4, a scribble ~4. */
const CROSSINGS_HI = 3.0;
/** If kept ink falls below this fraction of total ink, corrections dominate. */
const KEEP_MIN = 0.15;

interface Segment {
  x0: number;
  x1: number;
}

/** Otsu's method: the grayscale level that best splits ink from paper for this
 *  crop, so per-photo lighting doesn't need a hard-coded threshold. */
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

/** Binary ink mask (1 = ink) at the given threshold; ink is dark (≤ threshold). */
function inkMask(img: GrayImage, threshold: number): Uint8Array {
  const mask = new Uint8Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 1) mask[i] = img.data[i] <= threshold ? 1 : 0;
  return mask;
}

/** Longest horizontal run of ink in a row, within columns [x0, x1]. */
function widestRun(mask: Uint8Array, w: number, y: number, x0: number, x1: number): number {
  let run = 0;
  let best = 0;
  for (let x = x0; x <= x1; x += 1) {
    if (mask[y * w + x]) {
      run += 1;
      if (run > best) best = run;
    } else run = 0;
  }
  return best;
}

/** Clear rows that are inked across most of the full width (printed rule or
 *  underline). Mutates the mask; returns the rows cleared, for whitening. */
function stripRules(mask: Uint8Array, w: number, h: number): number[] {
  const rows: number[] = [];
  for (let y = 0; y < h; y += 1) {
    if (widestRun(mask, w, y, 0, w - 1) >= RULE_W * w) {
      for (let x = 0; x < w; x += 1) mask[y * w + x] = 0;
      rows.push(y);
    }
  }
  return rows;
}

/** Ink pixels per column. */
function columnInk(mask: Uint8Array, w: number, h: number): number[] {
  const cols = new Array(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) if (mask[row + x]) cols[x] += 1;
  }
  return cols;
}

/** Split the crop into word-ish segments by column-ink projection: runs of
 *  inked columns, merged across intra-word gaps, with specks dropped. */
function segment(colInk: number[], w: number, h: number): Segment[] {
  const floor = Math.max(1, Math.round(INK_MIN_COL * h));
  const mergeGap = Math.round(MERGE_GAP * h);
  const minSeg = Math.round(MIN_SEG * h);

  const runs: Segment[] = [];
  let start = -1;
  for (let x = 0; x < w; x += 1) {
    const inked = colInk[x] >= floor;
    if (inked && start < 0) start = x;
    else if (!inked && start >= 0) {
      runs.push({ x0: start, x1: x - 1 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ x0: start, x1: w - 1 });

  const merged: Segment[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r.x0 - last.x1 - 1 < mergeGap) last.x1 = r.x1;
    else merged.push({ ...r });
  }
  return merged.filter((s) => s.x1 - s.x0 + 1 >= minSeg);
}

/** Mean number of vertical ink-runs per inked column — how often strokes stack
 *  or cross in a column. High for a loose scribble/X, low for plain letters. */
function crossings(mask: Uint8Array, w: number, x0: number, x1: number, yTop: number, yBot: number): number {
  let runsTotal = 0;
  let inkedCols = 0;
  for (let x = x0; x <= x1; x += 1) {
    let runs = 0;
    let prev = 0;
    for (let y = yTop; y <= yBot; y += 1) {
      const v = mask[y * w + x];
      if (v && !prev) runs += 1;
      prev = v;
    }
    if (runs > 0) {
      runsTotal += runs;
      inkedCols += 1;
    }
  }
  return inkedCols === 0 ? 0 : runsTotal / inkedCols;
}

interface SegmentFeatures {
  seg: Segment;
  ink: number;
  /** Whether this segment is a scribble (a scribbled-out word). */
  scribble: boolean;
}

/** Measure one segment and decide whether it is a scribbled-out word: word-wide
 *  (not a lone letter) and either heavily inked or full of stroke-crossings. */
function measure(mask: Uint8Array, w: number, x0: number, x1: number, h: number): SegmentFeatures {
  const seg = { x0, x1 };
  const segW = x1 - x0 + 1;
  let yTop = h;
  let yBot = -1;
  let ink = 0;
  for (let y = 0; y < h; y += 1) {
    let count = 0;
    for (let x = x0; x <= x1; x += 1) if (mask[y * w + x]) count += 1;
    if (count > 0) {
      if (y < yTop) yTop = y;
      if (y > yBot) yBot = y;
      ink += count;
    }
  }
  if (yBot < 0) return { seg, ink: 0, scribble: false };

  const density = ink / (segW * (yBot - yTop + 1));
  const scribble =
    segW >= MIN_CORRECTION_W * h &&
    density >= DENSITY_MIN &&
    (density >= DENSITY_HI || crossings(mask, w, x0, x1, yTop, yBot) >= CROSSINGS_HI);

  return { seg, ink, scribble };
}

/** Whiten the given segments (full height, which also clears the printed rule
 *  under them) in a copy of the crop. The rule elsewhere is left in place — it
 *  helps OCR read the surviving words, and is only used internally (for
 *  segmentation), never scrubbed from a crop we didn't otherwise change. */
function whiten(img: GrayImage, segments: Segment[]): GrayImage {
  const { width: w, height: h } = img;
  const data = Uint8Array.from(img.data);
  for (const s of segments) {
    for (let y = 0; y < h; y += 1) {
      const row = y * w;
      for (let x = s.x0; x <= s.x1; x += 1) data[row + x] = 255;
    }
  }
  return { width: w, height: h, data };
}

/**
 * Detect a scribbled-out word, whiten it, and report whether enough clean text
 * remains to read. The printed rule is stripped *internally* (to separate
 * words for detection) but never from the returned image unless a scribble is
 * also removed — so when nothing is found, OCR gets the original crop
 * untouched, rather than a de-ruled image it may read worse. Callers OCR the
 * returned `image`; when `dominated`, they should skip OCR and require manual
 * entry from the crop instead.
 */
export function stripCorrections(img: GrayImage): CorrectionResult {
  const { width: w, height: h } = img;
  if (w === 0 || h === 0) return { image: img, corrected: false, dominated: false };

  const mask = inkMask(img, otsuThreshold(img));
  stripRules(mask, w, h); // internal only: un-bridge words for segmentation
  const segments = segment(columnInk(mask, w, h), w, h);

  const drop: Segment[] = [];
  let totalInk = 0;
  let keptInk = 0;
  for (const f of segments.map((s) => measure(mask, w, s.x0, s.x1, h))) {
    totalInk += f.ink;
    if (f.scribble) drop.push(f.seg);
    else keptInk += f.ink;
  }

  // Nothing to remove → return the crop untouched (don't alter OCR's input).
  if (drop.length === 0) return { image: img, corrected: false, dominated: false };

  const dominated = totalInk === 0 || keptInk < KEEP_MIN * totalInk;
  return { image: whiten(img, drop), corrected: true, dominated };
}
