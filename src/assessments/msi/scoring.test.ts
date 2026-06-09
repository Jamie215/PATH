/**
 * Validates the TypeScript MSI scoring against ground-truth outputs
 * generated from the original Python implementation.
 *
 * The fixtures in __fixtures__/python-ground-truth.json were produced by
 * running the unchanged msi.py from the original Flask app against a
 * variety of inputs. If anything in scoring.ts diverges from the Python
 * behavior, these tests will fail.
 *
 * To regenerate fixtures (only do this if the original Python scoring
 * intentionally changes — not to mask a bug): see scripts/generate-msi-fixtures.py
 */
import { describe, expect, it } from 'vitest';
import { score, type MSIResponse, type MSIResult } from './scoring';
import groundTruth from './__fixtures__/python-ground-truth.json';

interface Case {
  name: string;
  input: Record<string, number | string>;
  expected: MSIResult;
}

const cases = groundTruth as Case[];

describe('MSI scoring — parity with Python reference', () => {
  for (const c of cases) {
    it(c.name, () => {
      const result = score(c.input as unknown as MSIResponse);

      expect(result.somatic).toBe(c.expected.somatic);
      expect(result.nonsomatic).toBe(c.expected.nonsomatic);
      expect(result.symp_no).toBe(c.expected.symp_no);
      expect(result.full_rec).toBe(c.expected.full_rec);
      expect(result.mdd).toBe(c.expected.mdd);
      expect(result.comments).toBe(c.expected.comments);
      expect(result.labels).toEqual(c.expected.labels);
      expect(result.vals).toEqual(c.expected.vals);
      // Means involve division; allow tiny floating-point tolerance.
      expect(result.freq_mean).toBeCloseTo(c.expected.freq_mean, 10);
      expect(result.int_mean).toBeCloseTo(c.expected.int_mean, 10);
    });
  }
});

describe('MSI scoring — invariants and edge cases', () => {
  it('all-zero input produces all-zero scores', () => {
    const input: Partial<MSIResponse> = {};
    for (const s of ['sharp', 'dull', 'stiff', 'weak', 'sensitive',
                     'numb', 'fatigue', 'foggy', 'nausea', 'anxiety'] as const) {
      (input as Record<string, number>)[`${s}_freq`] = 0;
    }
    const r = score(input as MSIResponse);
    expect(r.somatic).toBe(0);
    expect(r.nonsomatic).toBe(0);
    expect(r.symp_no).toBe(0);
    expect(r.vals.every((v) => v === 0)).toBe(true);
    expect(r.freq_mean).toBe(0);
    expect(r.int_mean).toBe(0);
  });

  it('all-max input hits the theoretical maxima (somatic=60, nonsomatic=72)', () => {
    const input: Record<string, number> = {};
    for (const s of ['sharp', 'dull', 'stiff', 'weak', 'sensitive',
                     'numb', 'fatigue', 'foggy', 'nausea', 'anxiety']) {
      input[`${s}_freq`] = 3;
      input[`${s}_interference`] = 4;
    }
    const r = score(input as unknown as MSIResponse);
    expect(r.somatic).toBe(60); // 5 symptoms × 12
    expect(r.nonsomatic).toBe(72); // 6 symptoms × 12 (numb counted in both)
  });

  it('numb is intentionally counted in both somatic and nonsomatic', () => {
    // Isolate numb at max — should add 12 to both totals
    const input: Record<string, number> = {
      sharp_freq: 0, dull_freq: 0, stiff_freq: 0, weak_freq: 0,
      sensitive_freq: 0, fatigue_freq: 0, foggy_freq: 0,
      nausea_freq: 0, anxiety_freq: 0,
      numb_freq: 3, numb_interference: 4,
    };
    const r = score(input as unknown as MSIResponse);
    expect(r.somatic).toBe(12);
    expect(r.nonsomatic).toBe(12);
  });

  it('omits comments → default placeholder', () => {
    const input: Record<string, number | string> = {};
    for (const s of ['sharp', 'dull', 'stiff', 'weak', 'sensitive',
                     'numb', 'fatigue', 'foggy', 'nausea', 'anxiety']) {
      input[`${s}_freq`] = 0;
    }
    expect(score(input as unknown as MSIResponse).comments).toBe('No comment provided.');
  });

  it('preserves provided comments', () => {
    const input: Record<string, number | string> = { other_comments: 'tender to touch' };
    for (const s of ['sharp', 'dull', 'stiff', 'weak', 'sensitive',
                     'numb', 'fatigue', 'foggy', 'nausea', 'anxiety']) {
      input[`${s}_freq`] = 0;
    }
    expect(score(input as unknown as MSIResponse).comments).toBe('tender to touch');
  });

  it('labels are in canonical symptom order', () => {
    const input: Record<string, number> = {};
    for (const s of ['sharp', 'dull', 'stiff', 'weak', 'sensitive',
                     'numb', 'fatigue', 'foggy', 'nausea', 'anxiety']) {
      input[`${s}_freq`] = 0;
    }
    expect(score(input as unknown as MSIResponse).labels[0]).toBe('Sharp or shooting pain');
    expect(score(input as unknown as MSIResponse).labels[9]).toBe(
      'Nervousness, anxiety or sadness',
    );
  });

  it('throws if frequency > 0 but interference is missing', () => {
    const input: Record<string, number> = {
      sharp_freq: 2, // freq>0 with no interference — malformed
      dull_freq: 0, stiff_freq: 0, weak_freq: 0, sensitive_freq: 0,
      numb_freq: 0, fatigue_freq: 0, foggy_freq: 0,
      nausea_freq: 0, anxiety_freq: 0,
    };
    expect(() => score(input as unknown as MSIResponse)).toThrow();
  });
});
