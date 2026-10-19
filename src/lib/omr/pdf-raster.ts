/**
 * Browser shim: rasterize a scanned PDF into one `GrayImage` per page, so a
 * document-scanner's multi-page output can go through the same OMR pipeline as
 * a photo. This is the only place we pull in pdf.js, and it's dynamically
 * imported at upload time so the ~1 MB library never weighs down first paint.
 *
 * Like `decode-image`, this touches a canvas and is browser-only — it is not
 * part of the DOM-free, unit-tested reader core.
 */
import type { GrayImage } from './types';
import { rgbaToGray } from './decode-image';

// The `?url` import below resolves to the bundled worker asset's URL — typed by
// Astro's global `*?url` module declaration (astro/client).

/** Longest side of a rasterized page, in pixels: enough to resolve bubbles,
 *  small enough to stay fast. (Slightly above decode-image's 1800 for photos,
 *  since a scanner's flat page has no perspective loss to absorb.) */
const MAX_DIMENSION = 2000;

/** Render each page of a PDF to a grayscale buffer the reader can consume. */
export async function rasterizePdfToGray(blob: Blob): Promise<GrayImage[]> {
  // The legacy build: pdf.js 6's modern build relies on brand-new JavaScript
  // (e.g. Map.getOrInsertComputed) and fails on browsers a few versions old;
  // the legacy build polyfills it.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const pages: GrayImage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, MAX_DIMENSION / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get a 2D canvas context.');
      // Scanned pages can carry transparency; paint white behind them so a
      // clear region reads as paper, not black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      // pdf.js v6 requires the canvas itself in the render params (not just
      // its 2D context).
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      pages.push(rgbaToGray(ctx.getImageData(0, 0, width, height).data, width, height));
      page.cleanup();
    }
  } finally {
    // In pdf.js v6 the document is torn down via the loading task.
    await loadingTask.destroy();
  }
  return pages;
}
