import { describe, it, expect } from 'vitest';
import {
  sanitizeBothersomeArea,
  personalizeFreBAQItem,
  stripLeadingArticle,
  normalizeBothersomeArea,
} from './area';

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

describe('stripLeadingArticle', () => {
  it('drops a leading "my"', () => {
    expect(stripLeadingArticle('my right hand')).toBe('right hand');
    expect(stripLeadingArticle('My Right Hand')).toBe('Right Hand');
  });

  it('drops a leading "the"', () => {
    expect(stripLeadingArticle('the lower back')).toBe('lower back');
  });

  it('leaves a real word beginning with those letters intact', () => {
    expect(stripLeadingArticle('mystery region')).toBe('mystery region');
    expect(stripLeadingArticle('thenar eminence')).toBe('thenar eminence');
  });

  it('does not strip when there is nothing after the article', () => {
    expect(stripLeadingArticle('my')).toBe('my');
  });

  it('leaves a non-leading "my"/"the" alone', () => {
    expect(stripLeadingArticle('back of my hand')).toBe('back of my hand');
  });
});

describe('normalizeBothersomeArea', () => {
  it('strips punctuation and a leading article together', () => {
    expect(normalizeBothersomeArea('my right hand.')).toBe('right hand');
    expect(normalizeBothersomeArea('The mid-back!')).toBe('mid back');
  });

  it('returns empty for an article-only entry', () => {
    expect(normalizeBothersomeArea('my')).toBe('my');
    expect(normalizeBothersomeArea('')).toBe('');
  });
});

describe('personalizeFreBAQItem', () => {
  it('substitutes "my {area}" into mid-sentence "the area" phrasing', () => {
    expect(
      personalizeFreBAQItem('When performing everyday tasks, the area moves without me understanding why.', 'right knee'),
    ).toBe('When performing everyday tasks, my right knee moves without me understanding why.');
  });

  it('capitalizes the possessive at the start of a sentence', () => {
    expect(
      personalizeFreBAQItem('The area feels very lopsided, or out of proportion.', 'left hand'),
    ).toBe('My left hand feels very lopsided, or out of proportion.');
  });

  it('replaces every occurrence in an item', () => {
    expect(personalizeFreBAQItem('The area and the area again.', 'neck')).toBe(
      'My neck and my neck again.',
    );
  });

  it('strips a leading "my"/"the" from the region so it is not doubled', () => {
    expect(personalizeFreBAQItem('The area feels lopsided.', 'my right hand')).toBe(
      'My right hand feels lopsided.',
    );
    expect(personalizeFreBAQItem('the area moves.', 'the lower back')).toBe('my lower back moves.');
  });

  it('trims surrounding whitespace from the area', () => {
    expect(personalizeFreBAQItem('The area is here.', '  neck  ')).toBe('My neck is here.');
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
