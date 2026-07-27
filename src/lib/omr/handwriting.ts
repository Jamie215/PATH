/**
 * Handwriting recognition for cropped free-text regions, using an on-device
 * TrOCR model via transformers.js.
 *
 * The model is large, so it is imported and instantiated lazily on first use
 * and cached for the session. Everything is best-effort: any failure (model
 * can't download, WebAssembly unsupported, unreadable crop) resolves to an
 * empty string, so the crop-and-confirm UI still works — the user just types
 * the value while looking at the cropped image.
 *
 * Runs entirely in the browser: the patient's handwriting never leaves the
 * device, unlike a cloud OCR API.
 */

type Recognizer = (
  input: string,
) => Promise<Array<{ generated_text?: string }> | { generated_text?: string }>;

let recognizerPromise: Promise<Recognizer> | null = null;

/** Lazily load the TrOCR pipeline once; reused for every subsequent crop. */
async function getRecognizer(): Promise<Recognizer> {
  if (!recognizerPromise) {
    recognizerPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      // Small handwritten-text model — a balance of download size and accuracy
      // for short, single-line answers.
      return (await pipeline(
        'image-to-text',
        'Xenova/trocr-small-handwritten',
      )) as unknown as Recognizer;
    })();
  }
  return recognizerPromise;
}

/**
 * Recognize a line of handwriting from a data-URL image. Returns the trimmed
 * text, or '' on any failure (so callers can fall back to manual entry).
 */
export async function recognizeHandwriting(dataUrl: string): Promise<string> {
  try {
    const recognize = await getRecognizer();
    const out = await recognize(dataUrl);
    const first = Array.isArray(out) ? out[0] : out;
    return (first?.generated_text ?? '').trim();
  } catch {
    return '';
  }
}
