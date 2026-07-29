import { describe, it, expect } from 'vitest';
import { stripCorrections } from './correction';
import type { GrayImage } from './types';

/**
 * Build a GrayImage from an ASCII grid: '#' is ink (0), anything else is paper
 * (255). Rows are padded to equal width. Lets us hand-draw words and cancels.
 */
function img(rows: string[]): GrayImage {
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const data = new Uint8Array(width * height).fill(255);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x += 1) if (r[x] === '#') data[y * width + x] = 0;
  });
  return { width, height, data };
}

/** Total ink pixels in a region of columns [x0, x1]. */
function inkInCols(image: GrayImage, x0: number, x1: number): number {
  let n = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = x0; x <= x1; x += 1) if (image.data[y * image.width + x] === 0) n += 1;
  }
  return n;
}

// A clean word: thin vertical strokes with gaps — low density, no wide rows.
const CLEAN_WORD = [
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
  '.#...#...#..',
];

// A scribbled-out word: a solid dark block — very high density.
const SCRIBBLE = [
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
];

describe('stripCorrections', () => {
  it('leaves a clean word untouched', () => {
    const r = stripCorrections(img(CLEAN_WORD));
    expect(r.corrected).toBe(false);
    expect(r.dominated).toBe(false);
  });

  it('drops a scribbled word and keeps the clean one beside it', () => {
    // [clean word] [gap] [scribble] on one line.
    const rows = CLEAN_WORD.map((c, y) => `${c}....${SCRIBBLE[y]}`);
    const scan = img(rows);
    const r = stripCorrections(scan);
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(false);
    // The clean word (cols 0..10) survives; the scribble (cols 15..24) is gone.
    expect(inkInCols(r.image, 0, 10)).toBeGreaterThan(0);
    expect(inkInCols(r.image, 15, 24)).toBe(0);
  });

  it('handles a struck-through word (full-width band) beside a clean word', () => {
    const struck = CLEAN_WORD.map((c, y) => (y === 5 ? '##########' : c));
    const rows = CLEAN_WORD.map((c, y) => `${c}....${struck[y]}`);
    const r = stripCorrections(img(rows));
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(false);
    expect(inkInCols(r.image, 0, 10)).toBeGreaterThan(0); // clean word kept
    expect(inkInCols(r.image, 15, 24)).toBe(0); // struck word removed
  });

  it('reports dominated when the whole crop is a scribble', () => {
    const r = stripCorrections(img(SCRIBBLE));
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(true);
  });

  it('is a no-op on a blank crop', () => {
    const r = stripCorrections(img(['..........', '..........', '..........']));
    expect(r.corrected).toBe(false);
    expect(r.dominated).toBe(false);
  });
});
