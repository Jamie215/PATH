import { describe, it, expect } from 'vitest';
import * as phq4 from './phq4/scoring';
import * as slanss from './briefslanss/scoring';
import * as frebaq from './frebaq/scoring';
import { SCREENER_REPORTS } from './screener-reports';

/** Build a response with every item rated `value`, or per-item via an array. */
function respond(symptoms: readonly string[], values: number | number[], extra = {}) {
  const r: Record<string, unknown> = { ...extra };
  symptoms.forEach((s, i) => {
    r[`${s}_exp`] = Array.isArray(values) ? values[i] : values;
  });
  return r;
}

describe('PHQ-4', () => {
  const score = (v: number | number[]) => phq4.score(respond(phq4.SYMPTOMS, v) as phq4.PHQ4Response);

  it('sums the four 0–3 items', () => {
    expect(score([0, 1, 2, 3]).total_score).toBe(6);
    expect(score(3).total_score).toBe(phq4.MAX_SCORE);
  });

  it.each([
    [0, 'normal', 'Normal — minimal distress'],
    [2, 'normal', 'Normal — minimal distress'],
    [3, 'mild', 'Mild psychological distress'],
    [5, 'mild', 'Mild psychological distress'],
    [6, 'moderate', 'Moderate psychological distress'],
    [8, 'moderate', 'Moderate psychological distress'],
    [9, 'severe', 'Severe psychological distress'],
    [12, 'severe', 'Severe psychological distress'],
  ])('total %i → %s', (total, tone, interpretation) => {
    // Spread the total across items (max 3 each).
    const items = [0, 0, 0, 0].map((_, i) => Math.max(0, Math.min(3, total - 3 * i)));
    const r = score(items);
    expect(r.total_score).toBe(total);
    expect(r.interpretation).toBe(interpretation);
    expect(phq4.tone(total)).toBe(tone);
    expect(phq4.SCORING.isElevated(total)).toBe(total >= phq4.CUTOFFS.mild);
  });
});

describe('Brief S-LANSS', () => {
  const score = (v: number | number[]) =>
    slanss.score(respond(slanss.SYMPTOMS, v) as slanss.BriefSLANSSResponse);

  it('counts Yes answers', () => {
    expect(score([1, 0, 1, 0]).total_score).toBe(2);
    expect(score(1).total_score).toBe(slanss.MAX_SCORE);
  });

  it('flips to neuropathic at the cutoff', () => {
    expect(score([1, 1, 0, 0]).interpretation).toBe('Pain is less likely to be neuropathic');
    expect(score([1, 1, 1, 0]).interpretation).toBe('Pain is predominantly neuropathic');
    expect(slanss.tone(slanss.NEUROPATHIC_CUTOFF - 1)).toBe('normal');
    expect(slanss.tone(slanss.NEUROPATHIC_CUTOFF)).toBe('elevated');
  });
});

describe('FreBAQ', () => {
  const score = (v: number | number[], extra = {}) =>
    frebaq.score(respond(frebaq.SYMPTOMS, v, extra) as frebaq.FreBAQResponse);

  it('sums the six 0–4 items', () => {
    expect(score([0, 1, 2, 3, 4, 0]).total_score).toBe(10);
    expect(score(4).total_score).toBe(frebaq.MAX_SCORE);
  });

  it('flags the upper half as elevated', () => {
    expect(frebaq.tone(frebaq.ELEVATED_CUTOFF - 1)).toBe('normal');
    expect(frebaq.tone(frebaq.ELEVATED_CUTOFF)).toBe('elevated');
  });

  it('does not score the bothersome area', () => {
    expect(score(1, { bothersome_area: 'left knee' }).total_score).toBe(6);
  });
});

describe('shared screener behaviour', () => {
  it('uses the comment when given, else a placeholder', () => {
    const withComment = phq4.score(
      respond(phq4.SYMPTOMS, 0, { other_comments: 'Slept badly' }) as phq4.PHQ4Response,
    );
    expect(withComment.comments).toBe('Slept badly');
    expect(phq4.score(respond(phq4.SYMPTOMS, 0) as phq4.PHQ4Response).comments).toBe(
      'No comment provided.',
    );
  });

  it('counts a missing item as 0', () => {
    const r = respond(frebaq.SYMPTOMS, 2);
    delete r.notPart_exp;
    expect(frebaq.score(r as frebaq.FreBAQResponse).total_score).toBe(10);
  });

  it('report specs agree with the scorers they wrap', () => {
    expect(SCREENER_REPORTS.phq4.scoring.maxScore).toBe(phq4.MAX_SCORE);
    expect(SCREENER_REPORTS.briefslanss.scoring.maxScore).toBe(slanss.MAX_SCORE);
    expect(SCREENER_REPORTS.frebaq.scoring.maxScore).toBe(frebaq.MAX_SCORE);
    expect(SCREENER_REPORTS.phq4.note).toContain('0–2 normal, 3–5 mild, 6–8 moderate, 9–12 severe');
  });

});
