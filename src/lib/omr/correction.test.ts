import { describe, it, expect } from 'vitest';
import { stripCorrections } from './correction';
import type { GrayImage } from './types';

/**
 * Fixtures are drawn programmatically so they resemble real writing rather than
 * solid blocks: plain words are sparse vertical strokes; a scribble is a dense
 * band (the one instructed correction gesture); and every crop carries the
 * printed baseline rule that real crops include (and that used to bridge all
 * words into one un-droppable segment).
 */
const H = 20;
const TOP = 3;
const BOT = 14;
const RULE_Y = 17;

function canvas(width: number) {
  const data = new Uint8Array(width * H).fill(255);
  const ink = (x: number, y: number): void => {
    if (x >= 0 && x < width && y >= 0 && y < H) data[y * width + x] = 0;
  };
  return { data, ink, img: (): GrayImage => ({ width, height: H, data }) };
}

/** A plain word: sparse vertical strokes with wide gaps. */
function word(ink: (x: number, y: number) => void, x0: number, w: number): void {
  for (let s = 1; s < w - 1; s += 4) for (let y = TOP; y <= BOT; y += 1) ink(x0 + s, y);
}

/** A scribbled-out word: a dense back-and-forth band. */
function scribble(ink: (x: number, y: number) => void, x0: number, w: number): void {
  for (let y = TOP; y <= BOT; y += 1) for (let x = 1; x < w - 1; x += 1) if ((x + y) % 3 !== 0) ink(x0 + x, y);
}

function rule(ink: (x: number, y: number) => void, width: number): void {
  for (let x = 0; x < width; x += 1) ink(x, RULE_Y);
}

/** Compose "left <middle> hand" on one ruled line; returns the crop and the
 *  column span of the middle word so tests can check it was removed. */
function line(middle: (ink: (x: number, y: number) => void, x0: number, w: number) => void): {
  image: GrayImage;
  mid: [number, number];
} {
  const WORD = 16;
  const GAP = 12;
  const width = WORD * 3 + GAP * 2;
  const c = canvas(width);
  word(c.ink, 0, WORD);
  const midX = WORD + GAP;
  middle(c.ink, midX, WORD);
  word(c.ink, midX + WORD + GAP, WORD);
  rule(c.ink, width);
  return { image: c.img(), mid: [midX, midX + WORD - 1] };
}

function inkInCols(image: GrayImage, x0: number, x1: number): number {
  let n = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = x0; x <= x1; x += 1) if (image.data[y * image.width + x] === 0) n += 1;
  }
  return n;
}

describe('stripCorrections', () => {
  it('leaves a clean ruled line untouched (rule stripped, no false positives)', () => {
    const { image } = line(word);
    const r = stripCorrections(image);
    expect(r.corrected).toBe(false);
    expect(r.dominated).toBe(false);
  });

  it('drops a scribbled-out middle word and keeps the clean words', () => {
    const { image, mid } = line(scribble);
    const r = stripCorrections(image);
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(false);
    expect(inkInCols(r.image, mid[0], mid[1])).toBe(0);
    expect(inkInCols(r.image, 0, mid[0] - 4)).toBeGreaterThan(0); // "left" kept
  });

  it('reports dominated when the whole line is scribbled', () => {
    const c = canvas(40);
    scribble(c.ink, 2, 36);
    rule(c.ink, 40);
    const r = stripCorrections(c.img());
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(true);
  });

  it('is a no-op on a blank crop', () => {
    const c = canvas(40);
    const r = stripCorrections(c.img());
    expect(r.corrected).toBe(false);
    expect(r.dominated).toBe(false);
  });
});
