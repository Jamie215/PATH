import { describe, it, expect } from 'vitest';
import {
  sanitizeBothersomeArea,
  personalizeFreBAQItem,
  stripLeadingArticle,
  normalizeBothersomeArea,
  isPluralArea,
} from './area';
import { QUESTIONS } from './questions';

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

describe('isPluralArea', () => {
  it('treats single regions as singular', () => {
    expect(isPluralArea('right knee')).toBe(false);
    expect(isPluralArea('lower back')).toBe(false);
    expect(isPluralArea('neck')).toBe(false);
  });

  it('treats "-s" and coordinated regions as plural', () => {
    expect(isPluralArea('hands')).toBe(true);
    expect(isPluralArea('both knees')).toBe(true);
    expect(isPluralArea('hip and knee')).toBe(true);
  });

  it('handles irregular plurals and singular "-s" exceptions', () => {
    expect(isPluralArea('feet')).toBe(true);
    expect(isPluralArea('pelvis')).toBe(false);
  });

  it('is not fooled by trailing punctuation or an empty entry', () => {
    expect(isPluralArea('hands,')).toBe(true);
    expect(isPluralArea('')).toBe(false);
  });
});

describe('personalizeFreBAQItem', () => {
  const [notPart, withoutControl, withoutKnowingMoving, , cantPerceiveOutline, feelsLopsided] =
    QUESTIONS.map((q) => q.symptomLabel);

  it('weaves a singular region in with singular agreement', () => {
    expect(personalizeFreBAQItem(notPart, 'right knee')).toBe(
      'My right knee feels as though it is not part of the rest of my body.',
    );
    expect(personalizeFreBAQItem(withoutControl, 'right knee')).toBe(
      'Sometimes it feels as though my right knee is moving on its own, without my control.',
    );
  });

  it('agrees in number for a plural region', () => {
    expect(personalizeFreBAQItem(notPart, 'hands')).toBe(
      'My hands feel as though they are not part of the rest of my body.',
    );
    expect(personalizeFreBAQItem(withoutControl, 'both knees')).toBe(
      'Sometimes they feel as though my both knees are moving on their own, without my control.',
    );
    expect(personalizeFreBAQItem(withoutKnowingMoving, 'feet')).toBe(
      'When performing everyday tasks, my feet move without me understanding why.',
    );
  });

  it('uses lowercase "my" mid-sentence and keeps a fixed "are"', () => {
    expect(personalizeFreBAQItem(cantPerceiveOutline, 'left hand')).toBe(
      'The outline or borders of my left hand are difficult to perceive.',
    );
  });

  it('strips a leading "my"/"the" from the region so it is not doubled', () => {
    expect(personalizeFreBAQItem(feelsLopsided, 'my right hand')).toBe(
      'My right hand feels very lopsided, or out of proportion, to what it should be or compared to that on the opposite side.',
    );
  });

  it('falls back to the generic "the area", singular, when no area is given', () => {
    expect(personalizeFreBAQItem(notPart, '')).toBe(
      'The area feels as though it is not part of the rest of my body.',
    );
    expect(personalizeFreBAQItem(withoutControl, '   ')).toBe(
      'Sometimes it feels as though the area is moving on its own, without my control.',
    );
  });
});
