import { describe, it, expect } from 'vitest';
import { readSheet } from './reader';
import { warpPerspective } from './image';
import { homographyFromPoints } from './geometry';
import { renderSyntheticSheet } from './synth';
import { MSI_OMR_TEMPLATE as T } from '../../assessments/msi/omr-template';
import { score } from '../../assessments/msi/scoring';
import type { GrayImage, Pt } from './types';

/** Answer spec: frequency for every symptom, interference only when freq > 0. */
const ANSWERS: Record<string, number> = {
  sharp_freq: 2, sharp_interference: 3,
  dull_freq: 0,
  stiff_freq: 1, stiff_interference: 1,
  weak_freq: 3, weak_interference: 4,
  sensitive_freq: 0,
  numb_freq: 2, numb_interference: 2,
  fatigue_freq: 1, fatigue_interference: 2,
  foggy_freq: 0,
  nausea_freq: 1, nausea_interference: 3,
  anxiety_freq: 2, anxiety_interference: 1,
};

/** Response the reader should reconstruct (freq=0 rows drop interference). */
function expectedResponse(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ANSWERS)) {
    if (k.endsWith('_interference')) {
      const freq = ANSWERS[k.replace('_interference', '_freq')];
      if (freq > 0) out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

describe('readSheet — axis-aligned synthetic sheet', () => {
  const img = renderSyntheticSheet(T, ANSWERS, 2);
  const result = readSheet(img, T);

  it('locates the sheet', () => {
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('recovers the exact response with no warnings', () => {
    expect(result.response).toEqual(expectedResponse());
    expect(result.warnings).toEqual([]);
  });

  it('marks every decoded field ok with high confidence', () => {
    for (const f of result.fields) {
      // Interference fields on freq=0 rows are legitimately blank.
      if (f.status === 'blank') continue;
      expect(f.status).toBe('ok');
      expect(f.confidence).toBeGreaterThan(0.6);
    }
  });

  it('feeds a response the existing scorer accepts', () => {
    const r = score(result.response as never);
    expect(Number.isFinite(r.somatic)).toBe(true);
    expect(Number.isFinite(r.nonsomatic)).toBe(true);
  });
});

describe('readSheet — perspective-warped synthetic sheet (tilted photo)', () => {
  const source = renderSyntheticSheet(T, ANSWERS, 2);

  // Simulate a photo: map a tilted quad in the "photo" onto the flat sheet.
  const photoCorners: Pt[] = [
    { x: 70, y: 55 },
    { x: source.width - 40, y: 120 },
    { x: source.width - 90, y: source.height - 60 },
    { x: 30, y: source.height - 130 },
  ];
  const sheetCorners: Pt[] = [
    { x: 0, y: 0 },
    { x: source.width - 1, y: 0 },
    { x: source.width - 1, y: source.height - 1 },
    { x: 0, y: source.height - 1 },
  ];
  const photoToSheet = homographyFromPoints(photoCorners, sheetCorners)!;
  const photo: GrayImage = warpPerspective(source, photoToSheet, source.width, source.height);
  const result = readSheet(photo, T);

  it('still locates the sheet under perspective', () => {
    expect(result.ok).toBe(true);
  });

  it('recovers the exact response despite the tilt', () => {
    expect(result.response).toEqual(expectedResponse());
    expect(result.warnings).toEqual([]);
  });
});

describe('readSheet — failure handling', () => {
  it('reports when no sheet is present', () => {
    const blank: GrayImage = { width: 400, height: 500, data: new Uint8Array(400 * 500).fill(255) };
    const result = readSheet(blank, T);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('flags a required frequency left blank', () => {
    const partial = { ...ANSWERS };
    delete partial.fatigue_freq;
    const img = renderSyntheticSheet(T, partial, 2);
    const result = readSheet(img, T);
    expect(result.warnings.some((w) => w.includes('Fatigue'))).toBe(true);
    expect(result.response.fatigue_freq).toBeUndefined();
  });
});
