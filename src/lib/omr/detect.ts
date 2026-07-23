/**
 * Locate the answer sheet in a photo and label its four corners.
 *
 * Strategy:
 *  1. Threshold, then find connected components.
 *  2. Keep the solid, square-ish ones (high bounding-box fill) — these are the
 *     four corner fiducials plus the smaller orientation key. A hand-filled
 *     bubble is a disc (fill ~0.79), so the high-fill test rejects it.
 *  3. The four largest are the fiducials; the next solid square is the
 *     orientation key.
 *  4. Order the four fiducials into the template's TL/TR/BR/BL labels using
 *     the key: the fiducial nearest the key is BL (the template places the key
 *     there), and the rest follow the shared angular winding — which makes the
 *     labeling correct even if the photo is rotated 90/180/270°.
 *
 * Mirror-flipped scans are out of scope for now (documented, rare in practice).
 */
import type { GrayImage, Pt } from './types';
import type { OmrTemplate } from '../../assessments/omr/types';
import { adaptiveBinarize, connectedComponents, type Component } from './image';

export interface CornerLabels {
  TL: Pt;
  TR: Pt;
  BR: Pt;
  BL: Pt;
}

const MIN_FILL = 0.82; // solid squares only; discs (~0.79) are rejected
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.7;

function isSquareSolid(c: Component): boolean {
  const w = c.maxX - c.minX + 1;
  const h = c.maxY - c.minY + 1;
  const aspect = w / h;
  return c.fill >= MIN_FILL && aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

/** Sort points into a consistent angular order around their centroid. */
function angularOrder<T extends Pt>(pts: T[]): T[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Detect and label the sheet corners. Returns null if four solid corner marks
 * and an orientation key can't be found.
 */
export function detectCorners(img: GrayImage, template: OmrTemplate): CornerLabels | null {
  // Adaptive binarization survives shadows/tint that a global threshold can't.
  const radius = Math.max(15, Math.round(Math.min(img.width, img.height) / 16));
  const mask = adaptiveBinarize(img, radius, 12);
  // Fiducials scale with the page; require components of at least a modest size
  // relative to the image to skip specks.
  const minArea = Math.max(8, Math.round((img.width * img.height) / 200000));
  const squares = connectedComponents(mask, 128, minArea).filter(isSquareSolid);
  if (squares.length < 5) return null;

  // Four largest solid squares are the fiducials; the key is the largest of the
  // remainder (it is smaller than a fiducial but larger than stray marks).
  const byArea = [...squares].sort((a, b) => b.area - a.area);
  const fiducials = byArea.slice(0, 4).map((c): Pt => ({ x: c.cx, y: c.cy }));
  const key: Pt = { x: byArea[4].cx, y: byArea[4].cy };

  // The fiducial nearest the key is the bottom-left corner (template invariant).
  let blIdx = 0;
  for (let i = 1; i < 4; i += 1) {
    if (dist2(fiducials[i], key) < dist2(fiducials[blIdx], key)) blIdx = i;
  }
  const bl = fiducials[blIdx];

  // Put both the detected fiducials and the template fiducials into the same
  // angular order, then rotate the detected cycle so BL aligns with the
  // template's BL. Index k of each cycle then corresponds.
  const detCycle = angularOrder(fiducials);
  const tmplLabeled: { label: keyof CornerLabels; p: Pt }[] = [
    { label: 'TL', p: template.fiducials[0] },
    { label: 'TR', p: template.fiducials[1] },
    { label: 'BR', p: template.fiducials[2] },
    { label: 'BL', p: template.fiducials[3] },
  ];
  const tmplCycle = angularOrder(tmplLabeled.map((t) => ({ ...t.p, label: t.label }))) as {
    x: number;
    y: number;
    label: keyof CornerLabels;
  }[];

  const detBlPos = detCycle.findIndex((p) => p.x === bl.x && p.y === bl.y);
  const tmplBlPos = tmplCycle.findIndex((p) => p.label === 'BL');
  if (detBlPos < 0 || tmplBlPos < 0) return null;

  const labels: Partial<CornerLabels> = {};
  for (let k = 0; k < 4; k += 1) {
    const det = detCycle[(detBlPos + k) % 4];
    const label = tmplCycle[(tmplBlPos + k) % 4].label;
    labels[label] = { x: det.x, y: det.y };
  }
  if (!labels.TL || !labels.TR || !labels.BR || !labels.BL) return null;
  return labels as CornerLabels;
}
