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
 * Recognition runs entirely in the browser — the patient's handwriting never
 * leaves the device. What is downloaded, once (then kept in the browser's
 * cache):
 *   - the model files, from Hugging Face at `MODEL_REVISION` (~60–70 MB, 8-bit);
 *   - the ONNX Runtime WebAssembly, from this site's /ort/ (copied out of
 *     node_modules by scripts/copy-ort.mjs), not from a CDN.
 *
 * To upgrade the model deliberately: change `MODEL_REVISION`, then re-check
 * recognition against the real crops in ./__fixtures__ and a few scans.
 */
import type { GrayImage } from './types';
import { stripCorrections } from './correction';

/** Recognition outcome for one crop. */
export interface HandwritingResult {
  /** Recognized text (empty on failure, or when corrections dominate). */
  text: string;
  /** Correction marks were detected and removed before recognition. */
  corrected: boolean;
  /** Corrections dominate the crop — no OCR was attempted; enter from the crop. */
  dominated: boolean;
}

type Recognizer = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ generated_text?: string }> | { generated_text?: string }>;

const MODEL_ID = 'Xenova/trocr-small-handwritten';
/**
 * Model version to load: a release tag when the repo publishes one, otherwise
 * its `main` branch. On `main`, an upstream re-export is picked up
 * automatically; if it ever failed to load, the reviewer would simply enter
 * the area by hand. A tag or commit here freezes the version.
 */
const MODEL_REVISION = 'main';
/** Where this site serves the ONNX Runtime files (see scripts/copy-ort.mjs). */
const ORT_PATH = '/ort/';

let recognizerPromise: Promise<Recognizer> | null = null;

async function loadRecognizer(options: Record<string, unknown>): Promise<Recognizer> {
  const { pipeline, env } = await import('@huggingface/transformers');
  // transformers.js points the runtime at jsDelivr by default (picking the file
  // variant for this browser); keep its choice but serve the files ourselves.
  const wasm = env.backends.onnx.wasm;
  if (wasm && wasm.wasmPaths && typeof wasm.wasmPaths === 'object') {
    const paths = wasm.wasmPaths as Record<string, string>;
    for (const key of Object.keys(paths)) {
      if (!paths[key].startsWith(ORT_PATH)) paths[key] = ORT_PATH + paths[key].split('/').pop();
    }
  }
  return (await pipeline('image-to-text', MODEL_ID, {
    revision: MODEL_REVISION,
    ...options,
  })) as unknown as Recognizer;
}

async function getRecognizer(): Promise<Recognizer> {
  if (!recognizerPromise) {
    // The small 8-bit model on the GPU (fastest), else on the CPU. The
    // full-precision model (~250 MB) is deliberately never tried. Reset on
    // total failure so a later attempt can retry.
    recognizerPromise = (async () => {
      for (const options of [{ device: 'webgpu', dtype: 'q8' }, { dtype: 'q8' }]) {
        try {
          return await loadRecognizer(options);
        } catch {
          /* try the next configuration */
        }
      }
      throw new Error('handwriting model could not be loaded');
    })().catch((err) => {
      recognizerPromise = null;
      throw err;
    });
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

/**
 * Recognize a single line of handwriting from a cropped region. First detects
 * and removes scribbled-out corrections (see ./correction); if they
 * dominate the crop, skips OCR entirely so the reviewer transcribes from the
 * pinned crop instead of confirming a guess. Text is '' on any failure.
 */
export async function recognizeHandwriting(image: GrayImage): Promise<HandwritingResult> {
  const { image: cleaned, corrected, dominated } = stripCorrections(image);
  if (dominated) return { text: '', corrected, dominated };
  try {
    const recognize = await getRecognizer();
    // The fields are a few words, so cap decoding — far fewer autoregressive
    // steps than the default, which is the bulk of the per-crop time.
    const out = await recognize(preprocess(cleaned), { max_new_tokens: 24 });
    const first = Array.isArray(out) ? out[0] : out;
    return { text: (first?.generated_text ?? '').trim(), corrected, dominated };
  } catch {
    return { text: '', corrected, dominated };
  }
}
