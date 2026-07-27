/**
 * Handwriting recognition for cropped free-text regions, using an on-device
 * TrOCR model via transformers.js.
 *
 * TrOCR reads one line at a time, so a multi-line box (comments) is first
 * segmented into individual lines by its horizontal ink profile; each line is
 * contrast-stretched, padded, and upscaled before recognition, then the lines
 * are rejoined. Everything is best-effort: any failure resolves to '' so the
 * crop-and-confirm UI still works.
 *
 * Runs entirely in the browser — the patient's handwriting never leaves the
 * device.
 */
import type { GrayImage } from './types';

type Recognizer = (
  input: string,
) => Promise<Array<{ generated_text?: string }> | { generated_text?: string }>;

let recognizerPromise: Promise<Recognizer> | null = null;

async function getRecognizer(): Promise<Recognizer> {
  if (!recognizerPromise) {
    recognizerPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return (await pipeline(
        'image-to-text',
        'Xenova/trocr-small-handwritten',
      )) as unknown as Recognizer;
    })();
  }
  return recognizerPromise;
}

/**
 * Split a grayscale crop into text-line bands using its per-row ink profile.
 * Pure (no DOM), so it is unit-testable. Falls back to the whole image when it
 * can't find distinct lines.
 */
export function segmentLines(img: GrayImage): { y0: number; y1: number }[] {
  const { width: W, height: H, data } = img;
  if (H < 6 || W === 0) return [{ y0: 0, y1: H }];

  // Mean ink (0 = blank … 1 = black) per row, lightly smoothed.
  const ink = new Array<number>(H);
  for (let y = 0; y < H; y += 1) {
    let sum = 0;
    const o = y * W;
    for (let x = 0; x < W; x += 1) sum += 255 - data[o + x];
    ink[y] = sum / (W * 255);
  }
  const smooth = ink.map((_, y) => {
    let s = 0;
    let n = 0;
    for (let k = -1; k <= 1; k += 1) {
      const yy = y + k;
      if (yy >= 0 && yy < H) {
        s += ink[yy];
        n += 1;
      }
    }
    return s / n;
  });

  const peak = Math.max(...smooth);
  if (peak <= 0) return [];
  const threshold = Math.max(0.02, 0.18 * peak);

  // Contiguous rows above threshold form a band.
  const bands: { y0: number; y1: number }[] = [];
  let start = -1;
  for (let y = 0; y < H; y += 1) {
    const on = smooth[y] >= threshold;
    if (on && start < 0) start = y;
    else if (!on && start >= 0) {
      bands.push({ y0: start, y1: y });
      start = -1;
    }
  }
  if (start >= 0) bands.push({ y0: start, y1: H });

  // Merge bands split by small gaps; drop specks.
  const mergeGap = Math.round(H * 0.04);
  const minH = Math.max(4, Math.round(H * 0.05));
  const merged: { y0: number; y1: number }[] = [];
  for (const b of bands) {
    const last = merged[merged.length - 1];
    if (last && b.y0 - last.y1 <= mergeGap) last.y1 = b.y1;
    else merged.push({ ...b });
  }
  const kept = merged.filter((b) => b.y1 - b.y0 >= minH);
  return kept.length ? kept : [{ y0: 0, y1: H }];
}

/** Contrast-stretch a band, pad it with white, upscale it, and return a PNG
 *  data URL suitable for the recognizer. Browser-only (uses a canvas). */
function bandToDataUrl(img: GrayImage, y0: number, y1: number): string {
  const { width: W, data } = img;
  const padV = 8;
  const padH = 12;
  const b0 = Math.max(0, y0 - 2);
  const b1 = Math.min(img.height, y1 + 2);
  const bandH = Math.max(1, b1 - b0);

  // Percentile-ish stretch: darkest/lightest in the band map to 0/255.
  let lo = 255;
  let hi = 0;
  for (let y = b0; y < b1; y += 1) {
    const o = y * W;
    for (let x = 0; x < W; x += 1) {
      const v = data[o + x];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const range = Math.max(1, hi - lo);

  const srcW = W + padH * 2;
  const srcH = bandH + padV * 2;
  const buf = new Uint8ClampedArray(srcW * srcH * 4).fill(255);
  for (let y = 0; y < bandH; y += 1) {
    const o = (b0 + y) * W;
    for (let x = 0; x < W; x += 1) {
      const v = Math.max(0, Math.min(255, Math.round(((data[o + x] - lo) / range) * 255)));
      const di = ((y + padV) * srcW + (x + padH)) * 4;
      buf[di] = v;
      buf[di + 1] = v;
      buf[di + 2] = v;
    }
  }

  const source = document.createElement('canvas');
  source.width = srcW;
  source.height = srcH;
  source.getContext('2d')!.putImageData(new ImageData(buf, srcW, srcH), 0, 0);

  // Upscale short lines so glyphs are large enough for the recognizer.
  const scale = Math.max(1, Math.min(4, Math.round(64 / srcH)));
  const dest = document.createElement('canvas');
  dest.width = srcW * scale;
  dest.height = srcH * scale;
  const dctx = dest.getContext('2d')!;
  dctx.imageSmoothingEnabled = true;
  dctx.drawImage(source, 0, 0, dest.width, dest.height);
  return dest.toDataURL('image/png');
}

/**
 * Recognize handwriting in a cropped region. A `box` is segmented into lines
 * and each recognized separately; a `line` is recognized whole. Returns the
 * joined text, or '' on any failure.
 */
export async function recognizeCrop(image: GrayImage, kind: 'line' | 'box'): Promise<string> {
  try {
    const recognize = await getRecognizer();
    const bands = kind === 'box' ? segmentLines(image) : [{ y0: 0, y1: image.height }];
    const lines: string[] = [];
    for (const band of bands) {
      const url = bandToDataUrl(image, band.y0, band.y1);
      const out = await recognize(url);
      const first = Array.isArray(out) ? out[0] : out;
      const text = (first?.generated_text ?? '').trim();
      if (text) lines.push(text);
    }
    return lines.join('\n').trim();
  } catch {
    return '';
  }
}
