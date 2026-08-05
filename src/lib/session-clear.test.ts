import { describe, it, expect } from 'vitest';
import { sectionOf } from './session-clear';

describe('sectionOf', () => {
  it('treats the hub home as the empty section', () => {
    expect(sectionOf('/')).toBe('');
    expect(sectionOf('')).toBe('');
  });

  it('uses the first path segment as the section', () => {
    expect(sectionOf('/msi/')).toBe('msi');
    expect(sectionOf('/msi/results/')).toBe('msi');
    expect(sectionOf('/msi/survey')).toBe('msi');
  });

  it('keeps every step of a multi-page assessment in one section', () => {
    const composite = [
      '/pain-classification/',
      '/pain-classification/acute/',
      '/pain-classification/review/',
      '/pain-classification/results/',
    ].map(sectionOf);
    expect(new Set(composite)).toEqual(new Set(['pain-classification']));
  });

  it('distinguishes different assessments', () => {
    expect(sectionOf('/msi/results/')).not.toBe(sectionOf('/frebaq/results/'));
  });
});
