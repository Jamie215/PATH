/**
 * Test-only helper: rasterize a template into a synthetic `GrayImage` with a
 * chosen set of bubbles filled in, so the reader can be exercised end-to-end
 * without a real photograph. Draws the four fiducials, the orientation key,
 * every bubble outline, and a filled disc for each answer. Not shipped in the
 * app bundle (only imported by tests).
 */
import type { GrayImage } from './types';
import type { OmrTemplate } from '../../assessments/omr/types';

const INK = 10;
const RING = 70;

function fillRect(d: Uint8Array, W: number, cx: number, cy: number, side: number, v: number): void {
  const h = side / 2;
  for (let y = Math.round(cy - h); y <= Math.round(cy + h); y += 1) {
    for (let x = Math.round(cx - h); x <= Math.round(cx + h); x += 1) {
      d[y * W + x] = v;
    }
  }
}

function fillDisc(d: Uint8Array, W: number, cx: number, cy: number, r: number, v: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) d[y * W + x] = v;
    }
  }
}

function drawRing(d: Uint8Array, W: number, cx: number, cy: number, r: number, v: number): void {
  for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y += 1) {
    for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x += 1) {
      const dist = Math.hypot(x - cx, y - cy);
      if (Math.abs(dist - r) <= 1.2) d[y * W + x] = Math.min(d[y * W + x], v);
    }
  }
}

export interface SynthOptions {
  scale?: number;
  /** Base paper luminance (255 = white). Lower simulates off-white paper. */
  paper?: number;
  /** Peak luminance drop across a top-left→bottom-right gradient (a shadow). */
  shadow?: number;
}

/**
 * Render `template`, filling the bubbles named in `answers` (map of field key →
 * chosen value). `paper`/`shadow` simulate a real photo's off-white stock and
 * uneven lighting so the reader's background handling can be exercised.
 */
export function renderSyntheticSheet(
  template: OmrTemplate,
  answers: Record<string, number>,
  opts: number | SynthOptions = {},
): GrayImage {
  const { scale = 2, paper = 255, shadow = 0 } =
    typeof opts === 'number' ? { scale: opts } : opts;
  const W = Math.round(template.page.width * scale);
  const H = Math.round(template.page.height * scale);
  const d = new Uint8Array(W * H);
  // Paper background: base tint minus a diagonal shadow gradient.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const lum = paper - shadow * ((x / W + y / H) / 2);
      d[y * W + x] = Math.max(0, Math.min(255, Math.round(lum)));
    }
  }

  for (const f of template.fiducials) fillRect(d, W, f.x * W, f.y * H, template.fiducialSize * W, INK);
  const key = template.orientationMark;
  fillRect(d, W, key.center.x * W, key.center.y * H, key.size * W, INK);

  const r = template.bubbleRadius * W;
  for (const section of template.sections) {
    for (const row of section.rows) {
      for (const field of row.fields) {
        const chosen = answers[field.key];
        for (const bubble of field.bubbles) {
          drawRing(d, W, bubble.center.x * W, bubble.center.y * H, r, RING);
          if (chosen !== undefined && bubble.value === chosen) {
            fillDisc(d, W, bubble.center.x * W, bubble.center.y * H, r * 0.85, INK);
          }
        }
      }
    }
  }

  return { width: W, height: H, data: d };
}
