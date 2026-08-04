import { describe, it, expect } from 'vitest';
import { sanitizeBothersomeArea, personalizeFreBAQItem } from './area';

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

describe('personalizeFreBAQItem', () => {
  it('substitutes the area into mid-sentence "the area" phrasing', () => {
    expect(
      personalizeFreBAQItem('When performing everyday tasks, the area moves without me understanding why.', 'right knee'),
    ).toBe('When performing everyday tasks, the right knee moves without me understanding why.');
  });

  it('preserves the article capitalization at the start of a sentence', () => {
    expect(
      personalizeFreBAQItem('The area feels very lopsided, or out of proportion.', 'left hand'),
    ).toBe('The left hand feels very lopsided, or out of proportion.');
  });

  it('replaces every occurrence in an item', () => {
    expect(personalizeFreBAQItem('The area and the area again.', 'neck')).toBe(
      'The neck and the neck again.',
    );
  });

  it('trims surrounding whitespace from the area', () => {
    expect(personalizeFreBAQItem('The area is here.', '  neck  ')).toBe('The neck is here.');
  });

  it('leaves the wording untouched when the area is empty', () => {
    const label = 'The area feels lopsided.';
    expect(personalizeFreBAQItem(label, '')).toBe(label);
    expect(personalizeFreBAQItem(label, '   ')).toBe(label);
  });

  it('leaves items without the "the area" phrasing unchanged', () => {
    const label = 'Feels as though it is not part of the rest of my body.';
    expect(personalizeFreBAQItem(label, 'right knee')).toBe(label);
  });
});
