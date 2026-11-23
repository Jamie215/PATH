import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACUTE_CHILDREN, KEYS, hasAllFields, loadChildInputs } from './config';
import { set as storeSet } from '../../lib/storage';
import { fakeSessionStorage } from '../../lib/__fixtures__/session-storage';

const COMPLETE: Record<string, Record<string, number>> = {
  msi: { somatic: 20, nonsomatic: 10 },
  briefslanss: { total_score: 4 },
  frebaq: { total_score: 0 },
  phq4: { total_score: 7 },
};

const msi = ACUTE_CHILDREN.find((c) => c.slug === 'msi')!;

describe('hasAllFields', () => {
  it('needs a finite number for every manual field', () => {
    expect(hasAllFields(msi, { somatic: 20, nonsomatic: 10 })).toBe(true);
    expect(hasAllFields(msi, { somatic: 20 })).toBe(false);
    expect(hasAllFields(msi, { somatic: 20, nonsomatic: Number.NaN })).toBe(false);
    expect(hasAllFields(msi, null)).toBe(false);
  });

  it('counts 0 as a value, not as missing', () => {
    expect(hasAllFields(msi, { somatic: 0, nonsomatic: 0 })).toBe(true);
  });
});

describe('loadChildInputs', () => {
  beforeEach(() => vi.stubGlobal('window', { sessionStorage: fakeSessionStorage() }));
  afterEach(() => vi.unstubAllGlobals());

  const save = (inputs: Record<string, Record<string, number>>) => {
    for (const [slug, values] of Object.entries(inputs)) storeSet(KEYS.manualPrefix + slug, values);
  };

  it('returns every child once all are complete', () => {
    save(COMPLETE);
    expect(loadChildInputs()).toEqual(COMPLETE);
  });

  it('returns null when a child is missing', () => {
    const { phq4: _omit, ...rest } = COMPLETE;
    save(rest);
    expect(loadChildInputs()).toBeNull();
  });

  it('returns null when a child is only partly filled', () => {
    save({ ...COMPLETE, msi: { somatic: 20 } });
    expect(loadChildInputs()).toBeNull();
  });
});
