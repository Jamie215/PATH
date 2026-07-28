import { describe, it, expect } from 'vitest';
import { readSheet, detectStrikethrough } from './reader';
import { warpPerspective } from './image';
import { homographyFromPoints } from './geometry';
import { renderSyntheticSheet } from './synth';
import { MSI_OMR_TEMPLATE as T } from '../../assessments/msi/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../../assessments/frebaq/omr-template';
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

  it('recovers the exact response with no warnings or flags', () => {
    expect(result.response).toEqual(expectedResponse());
    expect(result.warnings).toEqual([]);
    expect(result.attention).toEqual([]);
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

describe('readSheet — free-text field crops', () => {
  const answers: Record<string, number> = {};
  for (const row of FREBAQ_OMR_TEMPLATE.sections[0].rows) answers[row.fields[0].key] = 0;
  const img = renderSyntheticSheet(FREBAQ_OMR_TEMPLATE, answers, 2);
  const result = readSheet(img, FREBAQ_OMR_TEMPLATE);

  it('returns one crop per declared scan text field', () => {
    expect(result.ok).toBe(true);
    expect(result.textCrops?.map((c) => c.key)).toEqual(['bothersome_area', 'other_comments']);
  });

  it('crops each region at the expected size and preserves its kind', () => {
    const canonW = FREBAQ_OMR_TEMPLATE.page.width * 2;
    const canonH = FREBAQ_OMR_TEMPLATE.page.height * 2;
    for (const field of FREBAQ_OMR_TEMPLATE.scanTextFields ?? []) {
      const crop = result.textCrops?.find((c) => c.key === field.key);
      expect(crop).toBeDefined();
      expect(crop!.kind).toBe(field.kind);
      expect(Math.abs(crop!.image.width - field.rect.width * canonW)).toBeLessThanOrEqual(2);
      expect(Math.abs(crop!.image.height - field.rect.height * canonH)).toBeLessThanOrEqual(2);
      expect(crop!.image.data.length).toBe(crop!.image.width * crop!.image.height);
    }
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

describe('readSheet — off-white paper with a shadow gradient', () => {
  // Only two symptoms marked; the other eight rows are blank and must NOT be
  // read as filled despite the darkened paper.
  const SPARSE: Record<string, number> = {
    sharp_freq: 2, sharp_interference: 3,
    numb_freq: 1, numb_interference: 4,
  };
  const img = renderSyntheticSheet(T, SPARSE, { scale: 2, paper: 205, shadow: 100 });
  const result = readSheet(img, T);

  it('locates the sheet on tinted, unevenly-lit paper', () => {
    expect(result.ok).toBe(true);
  });

  it('reads only the marked bubbles — no phantom marks on blank rows', () => {
    expect(result.response).toEqual({
      sharp_freq: 2, sharp_interference: 3,
      numb_freq: 1, numb_interference: 4,
    });
  });

  it('flags the genuinely blank rows as missing', () => {
    for (const label of ['Fatigue', 'Fogginess', 'Poor appetite or nausea']) {
      expect(result.warnings.some((w) => w.includes(label))).toBe(true);
    }
  });
});

describe('readSheet — small thin-pen dabs (not edge-to-edge fills)', () => {
  // A ~2pt dab in each answered bubble, well short of filling the circle.
  const img = renderSyntheticSheet(T, ANSWERS, { scale: 2, markRadiusPt: 2 });
  const result = readSheet(img, T);

  it('reads quick partial marks correctly', () => {
    expect(result.ok).toBe(true);
    expect(result.response).toEqual(expectedResponse());
    expect(result.warnings).toEqual([]);
  });
});

describe('readSheet — contested fields (double-mark / crossed-out answer)', () => {
  it('does not pick a winner when a frequency has two marks; flags it', () => {
    // Sharp frequency answer = 2 (Often), plus a second inked bubble at 1
    // (Rarely) — e.g. a wrong entry the user crossed out but still inked.
    const img = renderSyntheticSheet(T, ANSWERS, { scale: 2, extraMarks: { sharp_freq: [1] } });
    const result = readSheet(img, T);
    expect(result.response.sharp_freq).toBeUndefined();
    expect(result.response.sharp_interference).toBeUndefined(); // gated on frequency
    expect(result.warnings.some((w) => w.includes('Sharp') && /choose one/i.test(w))).toBe(true);
    expect(result.attention).toContain('sharp_freq');
  });

  it('flags a contested bothersomeness the same way', () => {
    const img = renderSyntheticSheet(T, ANSWERS, { scale: 2, extraMarks: { stiff_interference: [2] } });
    const result = readSheet(img, T);
    // stiff answer = freq 1 / interference 1, plus an extra interference mark at 2.
    expect(result.response.stiff_freq).toBe(1);
    expect(result.response.stiff_interference).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('Stiffness') && /choose one/i.test(w))).toBe(true);
  });
});

describe('detectStrikethrough — crossed-out word heuristic', () => {
  const W = 120;
  const H = 28;

  const blank = (): GrayImage => ({ width: W, height: H, data: new Uint8Array(W * H).fill(255) });
  const vbar = (img: GrayImage, x: number, y0: number, y1: number): void => {
    for (let y = y0; y <= y1; y += 1) for (let dx = 0; dx < 2; dx += 1) img.data[y * W + (x + dx)] = 0;
  };
  const hline = (img: GrayImage, x0: number, x1: number, y: number): void => {
    for (let x = x0; x <= x1; x += 1) for (let dy = 0; dy < 2; dy += 1) img.data[(y + dy) * W + x] = 0;
  };
  // A "word": several vertical pen strokes across x≈20..85, y=6..21 (16px tall).
  const word = (): GrayImage => {
    const img = blank();
    for (let x = 20; x <= 84; x += 8) vbar(img, x, 6, 21);
    return img;
  };

  it('flags a long horizontal strike through the middle of a word', () => {
    const img = word();
    hline(img, 20, 90, 13);
    expect(detectStrikethrough(img)).toBe(true);
  });

  it('does not flag ordinary handwriting (no long horizontal run)', () => {
    expect(detectStrikethrough(word())).toBe(false);
  });

  it('does not flag a short crossbar (e.g. the bar of a "t")', () => {
    const img = word();
    hline(img, 40, 52, 10);
    expect(detectStrikethrough(img)).toBe(false);
  });

  it('ignores an underline/rule captured at the baseline', () => {
    const img = word();
    hline(img, 20, 90, 20); // sits below the central band
    expect(detectStrikethrough(img)).toBe(false);
  });

  it('returns false for a near-empty crop', () => {
    expect(detectStrikethrough(blank())).toBe(false);
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
