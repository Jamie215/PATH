/**
 * Handwriting recognition for a short, single-line crop (the FreBAQ bothersome
 * area), using an on-device TrOCR model via transformers.js.
 *
 * TrOCR reads one line at a time, which suits the few-word fields we recognize.
 * Multi-line boxes (comments) are intentionally NOT sent here — they're slow
 * and low-value to recognize; the reader flags them as written-in and the
 * reviewer types them. The crop is contrast-stretched, padded, and upscaled
 * before recognition. Everything is best-effort: any failure resolves to ''.
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

/** Contrast-stretch a crop, pad it with white, upscale it, and return a PNG
 *  data URL suitable for the recognizer. Browser-only (uses a canvas). */
function preprocess(img: GrayImage): string {
  const { width: W, height: H, data } = img;
  const padV = 8;
  const padH = 12;

  // Stretch so the darkest/lightest pixels map to 0/255.
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] < lo) lo = data[i];
    if (data[i] > hi) hi = data[i];
  }
  const range = Math.max(1, hi - lo);

  const srcW = W + padH * 2;
  const srcH = H + padV * 2;
  const buf = new Uint8ClampedArray(srcW * srcH * 4).fill(255);
  for (let y = 0; y < H; y += 1) {
    const o = y * W;
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

  // Upscale short crops so glyphs are large enough for the recognizer.
  const scale = Math.max(1, Math.min(4, Math.round(64 / srcH)));
  const dest = document.createElement('canvas');
  dest.width = srcW * scale;
  dest.height = srcH * scale;
  const dctx = dest.getContext('2d')!;
  dctx.imageSmoothingEnabled = true;
  dctx.drawImage(source, 0, 0, dest.width, dest.height);
  return dest.toDataURL('image/png');
}

/** Recognize a single line of handwriting from a cropped region. Returns the
 *  trimmed text, or '' on any failure (so callers fall back to manual entry). */
export async function recognizeHandwriting(image: GrayImage): Promise<string> {
  try {
    const recognize = await getRecognizer();
    const out = await recognize(preprocess(image));
    const first = Array.isArray(out) ? out[0] : out;
    return (first?.generated_text ?? '').trim();
  } catch {
    return '';
  }
}
