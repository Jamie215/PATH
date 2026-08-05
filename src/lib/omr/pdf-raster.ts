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

// The `?url` import below resolves to the bundled worker asset's URL — typed by
// Astro's global `*?url` module declaration (astro/client).

/** Longest side of a rasterized page, in pixels — matches the scan pipeline's
 *  working resolution: enough to resolve bubbles, small enough to stay fast. */
const MAX_DIMENSION = 2000;

/** Render each page of a PDF to a grayscale buffer the reader can consume. */
export async function rasterizePdfToGray(blob: Blob): Promise<GrayImage[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
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
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data: rgba } = ctx.getImageData(0, 0, width, height);
      const gray = new Uint8Array(width * height);
      for (let p = 0, q = 0; p < gray.length; p += 1, q += 4) {
        // Rec. 601 luma, matching decode-image.
        gray[p] = (rgba[q] * 299 + rgba[q + 1] * 587 + rgba[q + 2] * 114) / 1000;
      }
      pages.push({ width, height, data: gray });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
