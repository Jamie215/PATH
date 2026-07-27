import { describe, it, expect } from 'vitest';
import { homographyFromPoints, applyH } from './geometry';
import type { Pt } from './types';

describe('homographyFromPoints', () => {
  it('reproduces the four correspondences exactly', () => {
    const src: Pt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const dst: Pt[] = [
      { x: 12, y: 8 },
      { x: 205, y: 30 },
      { x: 190, y: 220 },
      { x: 5, y: 195 },
    ];
    const H = homographyFromPoints(src, dst);
    expect(H).not.toBeNull();
    for (let i = 0; i < 4; i += 1) {
      const p = applyH(H!, src[i].x, src[i].y);
      expect(p.x).toBeCloseTo(dst[i].x, 4);
      expect(p.y).toBeCloseTo(dst[i].y, 4);
    }
  });

  it('inverts a round trip (canonical → photo → canonical)', () => {
    const canon: Pt[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 400 },
    ];
    const photo: Pt[] = [
      { x: 40, y: 25 },
      { x: 610, y: 70 },
      { x: 650, y: 780 },
      { x: 20, y: 700 },
    ];
    const forward = homographyFromPoints(canon, photo)!;
    const back = homographyFromPoints(photo, canon)!;
    const mid = applyH(forward, 150, 200);
    const round = applyH(back, mid.x, mid.y);
    expect(round.x).toBeCloseTo(150, 3);
    expect(round.y).toBeCloseTo(200, 3);
  });

  it('returns null for degenerate (collinear) points', () => {
    const src: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const dst: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(homographyFromPoints(src, dst)).toBeNull();
  });
});
