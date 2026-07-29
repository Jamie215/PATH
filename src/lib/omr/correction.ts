/**
 * Correction-mark handling for a handwriting crop (the FreBAQ bothersome-area
 * line), run *before* OCR — "detect, drop, and read".
 *
 * People cancel a miswritten word in visually unrelated ways: a strike-through,
 * an "X" over it, or a scribble across it. Those share no common *shape*, so
 * keying on stroke orientation only ever catches one of them. What they share
 * is a *signal*: a cancel piles overlapping ink into a small region, spiking
 * local ink density and — for a strike/X — laying down a near-full-width
 * horizontal band through the middle of the word. This module keys on that,
 * so all three gestures are handled the same way.
 *
 * The realistic goal is not to reconstruct the glyphs *under* an X or scribble
 * (that ink is destroyed) but to find the cancelled region, whiten it, and let
 * OCR read whatever intended text remains (the replacement written beside it).
 * When the cancel dominates the crop — nothing clean is left, or the correction
 * overlaps the intended word — we say so (`dominated`) and the caller falls back
 * to the pinned crop for manual entry rather than feeding OCR garbage.
 *
 * DOM-free and pure: operates on a `GrayImage`, so it unit-tests headlessly.
 * Thresholds are first-pass defaults, to be calibrated against real sheets.
 */
import type { GrayImage } from './types';

export interface CorrectionResult {
  /** Crop with detected correction regions whitened out (unchanged if none). */
  image: GrayImage;
  /** A correction region was found and removed. */
  corrected: boolean;
  /** Corrections dominate — too little clean text remains to trust OCR, so the
   *  caller should flag for manual entry from the crop. */
  dominated: boolean;
}

/** Column counts as inked when at least this fraction of its height is ink. */
const INK_MIN_COL = 0.04;
/** Column gaps narrower than this (× height) are within a word, so merge. */
const MERGE_GAP = 0.5;
/** Ignore ink runs narrower than this (× height) — specks, not words. */
const MIN_SEG = 0.12;
/** A cancel spans a word; a segment narrower than this (× height) is a letter
 *  or stroke, never a correction, however dense it looks on its own. */
const MIN_CORRECTION_W = 0.6;
/** A row whose ink spans ≥ this fraction of a segment's width is a cross-stroke
 *  (the horizontal band of a strike-through or an X). */
const WIDE_ROW = 0.7;
/** Ink density (× a segment's content box) that alone reads as a scribble. */
const DENSITY_HI = 0.4;
/** Ink density that, together with a cross-stroke, reads as a strike/X. */
const DENSITY_MID = 0.22;
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
function segment(columnInk: number[], w: number, h: number): Segment[] {
  const floor = Math.max(1, Math.round(INK_MIN_COL * h));
  const mergeGap = Math.round(MERGE_GAP * h);
  const minSeg = Math.round(MIN_SEG * h);

  const runs: Segment[] = [];
  let start = -1;
  for (let x = 0; x < w; x += 1) {
    const inked = columnInk[x] >= floor;
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

/** Ink total and whether a segment looks like a cancelled word. */
function scoreSegment(
  mask: Uint8Array,
  w: number,
  x0: number,
  x1: number,
  h: number,
): { ink: number; correction: boolean } {
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
  if (yBot < 0) return { ink: 0, correction: false };

  // A cancel spans a word; a narrow segment (a letter/stroke) is never one,
  // however dense — this keeps a lone "l" or "i" from reading as a scribble.
  if (segW < MIN_CORRECTION_W * h) return { ink, correction: false };

  const segH = yBot - yTop + 1;
  const density = ink / (segW * segH);

  // Cross-stroke: a near-full-width row with word ink clearly above *and*
  // below it — the horizontal band a strike-through or X lays through a word.
  // (An underline or top bar has content on only one side, so it won't trip.)
  let crossStroke = false;
  for (let y = yTop; y <= yBot && !crossStroke; y += 1) {
    let run = 0;
    let best = 0;
    for (let x = x0; x <= x1; x += 1) {
      if (mask[y * w + x]) {
        run += 1;
        if (run > best) best = run;
      } else run = 0;
    }
    if (best >= WIDE_ROW * segW && y - yTop > 0.15 * segH && yBot - y > 0.15 * segH) {
      crossStroke = true;
    }
  }

  const correction = density >= DENSITY_HI || (crossStroke && density >= DENSITY_MID);
  return { ink, correction };
}

/** Whiten the given segments (full height) in a copy of the crop. */
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
 * Detect correction marks (strike-through / X / scribble), whiten those
 * regions, and report whether what's left is enough to read. Callers OCR the
 * returned `image`; when `dominated`, they should skip OCR and require manual
 * entry from the crop instead.
 */
export function stripCorrections(img: GrayImage): CorrectionResult {
  const { width: w, height: h } = img;
  if (w === 0 || h === 0) return { image: img, corrected: false, dominated: false };

  const mask = inkMask(img, otsuThreshold(img));
  const segments = segment(columnInk(mask, w, h), w, h);
  if (segments.length === 0) return { image: img, corrected: false, dominated: false };

  const drop: Segment[] = [];
  let totalInk = 0;
  let keptInk = 0;
  for (const seg of segments) {
    const { ink, correction } = scoreSegment(mask, w, seg.x0, seg.x1, h);
    totalInk += ink;
    if (correction) drop.push(seg);
    else keptInk += ink;
  }

  if (drop.length === 0) return { image: img, corrected: false, dominated: false };

  const dominated = totalInk === 0 || keptInk < KEEP_MIN * totalInk;
  return { image: whiten(img, drop), corrected: true, dominated };
}
