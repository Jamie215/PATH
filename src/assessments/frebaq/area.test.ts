import { describe, it, expect } from 'vitest';
import { sanitizeBothersomeArea } from './area';

describe('sanitizeBothersomeArea', () => {
  it('strips periods and commas', () => {
    expect(sanitizeBothersomeArea('left knee.')).toBe('left knee');
    expect(sanitizeBothersomeArea('neck,')).toBe('neck');
    expect(sanitizeBothersomeArea('left, hand')).toBe('left hand');
  });

  it('removes other punctuation and symbols', () => {
    expect(sanitizeBothersomeArea('right knee!?')).toBe('right knee');
    expect(sanitizeBothersomeArea('(left) hand *')).toBe('left hand');
  });

  it('turns separators into a space rather than fusing words', () => {
    expect(sanitizeBothersomeArea('mid-back')).toBe('mid back');
    expect(sanitizeBothersomeArea('neck/shoulder')).toBe('neck shoulder');
  });

  it('keeps letters, numbers, and collapses whitespace', () => {
    expect(sanitizeBothersomeArea('  left   2nd  toe ')).toBe('left 2nd toe');
    expect(sanitizeBothersomeArea('left knee')).toBe('left knee');
  });

  it('keeps accented letters', () => {
    expect(sanitizeBothersomeArea('épaule')).toBe('épaule');
  });

  it('returns empty for punctuation-only input', () => {
    expect(sanitizeBothersomeArea('...')).toBe('');
    expect(sanitizeBothersomeArea('')).toBe('');
  });
});
