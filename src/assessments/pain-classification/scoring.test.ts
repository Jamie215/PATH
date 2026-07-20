import { describe, it, expect } from 'vitest';
import { scoreAcute, CATEGORIES } from './scoring';

/**
 * Ground truth is the worked example in the source workbook
 * (Sheet1, columns R:Z): raw scores MSI Somatic 20, MSI Central 10,
 * Brief SLANSS 4, FreBAQ 0, PHQ-4 7.
 */
const workbookInputs = {
  msi: { somatic: 20, nonsomatic: 10 },
  briefslanss: { total_score: 4 },
  frebaq: { total_score: 0 },
  phq4: { total_score: 7 },
};

describe('scoreAcute — workbook worked example', () => {
  const r = scoreAcute(workbookInputs);

  it('reproduces the linear discriminant (Calc.) scores', () => {
    expect(r.scores['Mood-Dominant']).toBeCloseTo(3.46045, 3);
    expect(r.scores['Localized/Resilient']).toBeCloseTo(2.78359, 3);
    expect(r.scores['Central/Complex']).toBeCloseTo(-5.37868, 3);
    expect(r.scores['Neurosensory-Dominant']).toBeCloseTo(-0.75326, 3);
  });

  it('reproduces the softmax posterior probabilities', () => {
    expect(r.probabilities['Mood-Dominant']).toBeCloseTo(0.656537, 4);
    expect(r.probabilities['Localized/Resilient']).toBeCloseTo(0.333657, 4);
    expect(r.probabilities['Central/Complex']).toBeCloseTo(0.00009516, 5);
    expect(r.probabilities['Neurosensory-Dominant']).toBeCloseTo(0.009711, 4);
  });

  it('classifies to the highest-probability category', () => {
    expect(r.classification).toBe('Mood-Dominant');
  });

  it('produces probabilities that sum to 1', () => {
    const sum = CATEGORIES.reduce((s, c) => s + r.probabilities[c], 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('scoreAcute — Z standardisation endpoints', () => {
  it('maps min and max raws to the table endpoints', () => {
    const atMin = scoreAcute({
      msi: { somatic: 0, nonsomatic: 0 },
      briefslanss: { total_score: 0 },
      frebaq: { total_score: 0 },
      phq4: { total_score: 0 },
    });
    expect(atMin.z.somatic).toBeCloseTo(-2.00415, 5);
    expect(atMin.z.central).toBeCloseTo(-1.18272, 5);
    expect(atMin.z.phq4).toBeCloseTo(-1.20701, 5);

    const atMax = scoreAcute({
      msi: { somatic: 60, nonsomatic: 72 },
      briefslanss: { total_score: 4 },
      frebaq: { total_score: 24 },
      phq4: { total_score: 12 },
    });
    expect(atMax.z.somatic).toBeCloseTo(2.55216, 5);
    expect(atMax.z.central).toBeCloseTo(3.32006, 5);
    expect(atMax.z.frebaq).toBeCloseTo(3.05668, 5);
  });

  it('clamps out-of-range raws to the domain', () => {
    const over = scoreAcute({
      msi: { somatic: 999, nonsomatic: 999 },
      briefslanss: { total_score: 999 },
      frebaq: { total_score: 999 },
      phq4: { total_score: 999 },
    });
    expect(over.z.somatic).toBeCloseTo(2.55216, 5); // clamped to raw 60
  });
});
