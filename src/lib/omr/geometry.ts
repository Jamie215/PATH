/**
 * Planar homography from four point correspondences (the classic DLT), plus
 * point application. Used to map the template's canonical sheet coordinates
 * onto the photographed sheet (and back), correcting perspective and skew.
 */
import type { Mat3, Pt } from './types';

/** Solve an 8×8 linear system `A x = b` by Gaussian elimination with partial
 *  pivoting. Returns the solution vector, or null if the system is singular. */
function solve8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  // Work on an augmented copy.
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    // Partial pivot: largest magnitude in this column at or below the diagonal.
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null; // singular
    [m[col], m[pivot]] = [m[pivot], m[col]];

    // Eliminate below.
    for (let r = col + 1; r < n; r += 1) {
      const f = m[r][col] / m[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }

  // Back-substitution.
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = m[row][n];
    for (let c = row + 1; c < n; c += 1) sum -= m[row][c] * x[c];
    x[row] = sum / m[row][row];
  }
  return x;
}

/**
 * Homography H mapping each `src[i]` to `dst[i]` (four correspondences).
 * H is normalized so H[8] = 1. Returns null if the points are degenerate.
 */
export function homographyFromPoints(src: Pt[], dst: Pt[]): Mat3 | null {
  if (src.length < 4 || dst.length < 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve8(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Apply homography H to a point. */
export function applyH(H: Mat3, x: number, y: number): Pt {
  const u = H[0] * x + H[1] * y + H[2];
  const v = H[3] * x + H[4] * y + H[5];
  const w = H[6] * x + H[7] * y + H[8];
  return { x: u / w, y: v / w };
}
