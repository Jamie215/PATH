import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripCorrections } from './correction';
import type { GrayImage } from './types';

/**
 * Regression tests on *real* bothersome-area crops, extracted from photographed
 * sheets (see __fixtures__/*.jpg) through the actual warp/crop pipeline and
 * frozen as compact grayscale JSON so these run with no image-decoding
 * dependency. These are the cases that drove the detector's thresholds; keeping
 * them here stops a future tweak from silently regressing real scans.
 */
function loadCrop(name: string): GrayImage {
  const j = JSON.parse(readFileSync(`${__dirname}/__fixtures__/${name}.crop.json`, 'utf8'));
  return { width: j.width, height: j.height, data: new Uint8Array(Buffer.from(j.data, 'base64')) };
}

/** Total ink pixels in the crop. */
function totalInk(img: GrayImage): number {
  let n = 0;
  for (const v of img.data) if (v < 128) n += 1;
  return n;
}

describe('stripCorrections on real crops', () => {
  it('removes a scribbled-out word, keeping the words on either side ("left [scribble] hand")', () => {
    const crop = loadCrop('scribble-left-hand');
    const before = totalInk(crop);
    const r = stripCorrections(crop);
    expect(r.corrected).toBe(true);
    expect(r.dominated).toBe(false);
    // The dense scribble is a large share of the ink; removing it drops the
    // total sharply, while "left" and "hand" survive (some ink remains).
    const after = totalInk(r.image);
    expect(after).toBeLessThan(before * 0.6);
    expect(after).toBeGreaterThan(0);
  });

  it('leaves a clean write-in untouched ("right knee") — no false positive', () => {
    const r = stripCorrections(loadCrop('normal-right-knee-test'));
    expect(r.corrected).toBe(false);
    expect(r.dominated).toBe(false);
  });

  it('leaves an X-ed-out word for the reviewer (X is not the instructed gesture)', () => {
    // Standardized guidance is to scribble until illegible; a light X-out is
    // deliberately not auto-removed (too close to normal handwriting), so the
    // reviewer handles it against the pinned crop.
    const r = stripCorrections(loadCrop('xed-left-hand'));
    expect(r.corrected).toBe(false);
  });
});
