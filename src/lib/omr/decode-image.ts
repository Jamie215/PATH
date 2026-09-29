/**
 * Browser shim: decode an uploaded image (File/Blob) into a `GrayImage` the
 * DOM-free reader can consume. This is the only part of the OMR pipeline that
 * touches a canvas, so it's kept tiny and separate from the tested core.
 *
 * Phone photos are honored for EXIF orientation, and the image is downscaled
 * to a working resolution — large enough to resolve bubbles, small enough to
 * keep detection and warping fast.
 */
import type { GrayImage } from './types';

/** Longest side of the working image, in pixels. */
const MAX_DIMENSION = 1800;

/** Convert canvas RGBA pixels to a grayscale buffer (Rec. 601 luma). */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return { width, height, data: gray };
}

/** Decode a File/Blob into a grayscale buffer, downscaling if oversized. */
export async function blobToGrayImage(blob: Blob): Promise<GrayImage> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (typeof OffscreenCanvas !== 'undefined') {
      ctx = new OffscreenCanvas(width, height).getContext('2d');
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }
    if (!ctx) throw new Error('Could not get a 2D canvas context.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    return rgbaToGray(data, width, height);
  } finally {
    bitmap.close();
  }
}

/** Encode a grayscale buffer as a PNG data URL — for showing the flattened
 *  sheet in the confirmation UI. */
export function grayImageToDataURL(img: GrayImage): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context.');
  const out = ctx.createImageData(img.width, img.height);
  for (let i = 0, p = 0; i < img.data.length; i += 1, p += 4) {
    const v = img.data[i];
    out.data[p] = v;
    out.data[p + 1] = v;
    out.data[p + 2] = v;
    out.data[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}
