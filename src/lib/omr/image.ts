/**
 * Grayscale image primitives for the OMR pipeline: thresholding, connected
 * components (for fiducial detection), perspective warping, and disc-average
 * darkness sampling (for reading bubbles). All operate on plain `GrayImage`
 * buffers — no canvas, no DOM.
 */
import type { GrayImage, Mat3 } from './types';
import { applyH } from './geometry';

/** Otsu's method: the luminance threshold that best separates ink from paper. */
export function otsuThreshold(img: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  const { data } = img;
  for (let i = 0; i < data.length; i += 1) hist[data[i]] += 1;
  const total = data.length;

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
 * Adaptive (local-mean) binarization: a pixel is ink (0) when it is at least
 * `C` darker than the average luminance of the `radius`-neighborhood around
 * it, else paper (255). Unlike a global threshold, this survives shadows and
 * lighting gradients — essential for locating fiducials in a real photo.
 * Uses an integral image for O(1) box means.
 */
export function adaptiveBinarize(img: GrayImage, radius: number, C: number): GrayImage {
  const { width: W, height: H, data } = img;
  const IW = W + 1;
  const II = new Float64Array(IW * (H + 1));
  for (let y = 1; y <= H; y += 1) {
    let rowSum = 0;
    const base = y * IW;
    const prev = (y - 1) * IW;
    for (let x = 1; x <= W; x += 1) {
      rowSum += data[(y - 1) * W + (x - 1)];
      II[base + x] = II[prev + x] + rowSum;
    }
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(H - 1, y + radius);
    for (let x = 0; x < W; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(W - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        II[(y1 + 1) * IW + (x1 + 1)] -
        II[y0 * IW + (x1 + 1)] -
        II[(y1 + 1) * IW + x0] +
        II[y0 * IW + x0];
      const mean = sum / area;
      out[y * W + x] = data[y * W + x] < mean - C ? 0 : 255;
    }
  }
  return { width: W, height: H, data: out };
}

/** A connected region of ink pixels, with centroid and bounding box. */
export interface Component {
  area: number;
  cx: number;
  cy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** area / bounding-box area — ~1 for a solid square, ~0.79 for a filled disc. */
  fill: number;
}

/**
 * Label connected components of ink (pixels with luminance < threshold) using
 * 4-connectivity and an explicit stack (no recursion). Components smaller than
 * `minArea` pixels are discarded as noise.
 */
export function connectedComponents(
  img: GrayImage,
  threshold: number,
  minArea = 8,
): Component[] {
  const { width, height, data } = img;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const out: Component[] = [];

  for (let start = 0; start < data.length; start += 1) {
    if (seen[start] || data[start] >= threshold) continue;
    // Flood fill this component.
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const x = idx % width;
      const y = (idx - x) / width;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (x > 0 && !seen[idx - 1] && data[idx - 1] < threshold) {
        seen[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x < width - 1 && !seen[idx + 1] && data[idx + 1] < threshold) {
        seen[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (y > 0 && !seen[idx - width] && data[idx - width] < threshold) {
        seen[idx - width] = 1;
        stack.push(idx - width);
      }
      if (y < height - 1 && !seen[idx + width] && data[idx + width] < threshold) {
        seen[idx + width] = 1;
        stack.push(idx + width);
      }
    }

    if (area < minArea) continue;
    const bboxArea = (maxX - minX + 1) * (maxY - minY + 1);
    out.push({
      area,
      cx: sumX / area,
      cy: sumY / area,
      minX,
      minY,
      maxX,
      maxY,
      fill: area / bboxArea,
    });
  }
  return out;
}

/**
 * Warp `src` into an `outW × outH` image using homography `H`, where H maps
 * output (canonical) coordinates → source pixel coordinates. Inverse mapping
 * with bilinear sampling; samples outside the source read as white (255).
 */
export function warpPerspective(src: GrayImage, H: Mat3, outW: number, outH: number): GrayImage {
  const out = new Uint8Array(outW * outH);
  const { width, height, data } = src;

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const p = applyH(H, x, y);
      const sx = p.x;
      const sy = p.y;
      let value = 255;
      if (sx >= 0 && sy >= 0 && sx < width - 1 && sy < height - 1) {
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const fx = sx - x0;
        const fy = sy - y0;
        const i = y0 * width + x0;
        const a = data[i];
        const b = data[i + 1];
        const c = data[i + width];
        const d = data[i + width + 1];
        value =
          a * (1 - fx) * (1 - fy) +
          b * fx * (1 - fy) +
          c * (1 - fx) * fy +
          d * fx * fy;
      }
      out[y * outW + x] = value;
    }
  }
  return { width: outW, height: outH, data: out };
}

/**
 * Mean darkness (0 = white … 1 = black) over the annulus between `rInner` and
 * `rOuter`, centered at (cx, cy). Used to sample the clean paper *around* a
 * bubble as a local background, so paper tint and shadow can be subtracted out.
 */
export function annulusDarkness(
  img: GrayImage,
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
): number {
  const { width, height, data } = img;
  const minX = Math.max(0, Math.floor(cx - rOuter));
  const maxX = Math.min(width - 1, Math.ceil(cx + rOuter));
  const minY = Math.max(0, Math.floor(cy - rOuter));
  const maxY = Math.min(height - 1, Math.ceil(cy + rOuter));
  const ri2 = rInner * rInner;
  const ro2 = rOuter * rOuter;
  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < ri2 || d2 > ro2) continue;
      sum += 255 - data[y * width + x];
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count / 255;
}

/**
 * Mean darkness (0 = white … 1 = black) over the disc of radius `r` centered
 * at (cx, cy). Pixels outside the image are treated as white.
 */
export function discDarkness(img: GrayImage, cx: number, cy: number, r: number): number {
  const { width, height, data } = img;
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(height - 1, Math.ceil(cy + r));
  const r2 = r * r;
  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      sum += 255 - data[y * width + x];
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count / 255;
}
