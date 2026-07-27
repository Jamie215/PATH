/**
 * Unit tests for the pure line-segmentation used before handwriting OCR.
 * (The recognition itself is browser-only and not exercised here.)
 */
import { describe, it, expect } from 'vitest';
import { segmentLines } from './handwriting';
import type { GrayImage } from './types';

/** Build a GrayImage from a per-row luminance list (uniform across width). */
function fromRows(rows: number[], width = 40): GrayImage {
  const height = rows.length;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) data.fill(rows[y], y * width, (y + 1) * width);
  return { width, height, data };
}

function bands(blankGap: number, inkRun: number, count: number): number[] {
  const rows: number[] = [];
  for (let i = 0; i < count; i += 1) {
    for (let b = 0; b < blankGap; b += 1) rows.push(255);
    for (let k = 0; k < inkRun; k += 1) rows.push(45);
  }
  for (let b = 0; b < blankGap; b += 1) rows.push(255);
  return rows;
}

describe('segmentLines', () => {
  it('splits three ink bands separated by blank gaps', () => {
    expect(segmentLines(fromRows(bands(6, 8, 3))).length).toBe(3);
  });

  it('returns a single band for one line of text', () => {
    expect(segmentLines(fromRows(bands(6, 10, 1))).length).toBe(1);
  });

  it('falls back to the whole image for a tiny crop', () => {
    const out = segmentLines(fromRows([255, 45, 45]));
    expect(out).toEqual([{ y0: 0, y1: 3 }]);
  });
});
