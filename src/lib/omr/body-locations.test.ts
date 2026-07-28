import { describe, it, expect } from 'vitest';
import { matchBodyLocation, autofillBodyLocation } from './body-locations';

/** Top suggested label for a raw entry, or undefined when nothing matched. */
const top = (raw: string): string | undefined => matchBodyLocation(raw)[0]?.label;

describe('matchBodyLocation', () => {
  it('matches a clean entry with laterality', () => {
    expect(top('left knee')).toBe('left knee');
    expect(top('right shoulder')).toBe('right shoulder');
  });

  it('recovers OCR substitutions and transpositions from a struck-through word', () => {
    // 'left knee' with an OCR-mangled diacritic and a transposed 'left'.
    expect(top('lefr kṇee')).toBe('left knee');
    // 'right hip' with both tokens garbled by transposition.
    expect(top('rihgt hpi')).toBe('right hip');
  });

  it('resolves synonyms to the canonical region', () => {
    expect(top('lumbar')).toBe('lower back');
    expect(top('low back')).toBe('lower back');
    expect(top('scapula')).toBe('shoulder blade');
    expect(top('clavicle')).toBe('collarbone');
    expect(top('coccyx')).toBe('tailbone');
  });

  it('reads one/two-letter laterality shorthand', () => {
    expect(top('l shoulder')).toBe('left shoulder');
    expect(top('rt ankle')).toBe('right ankle');
  });

  it('drops a written side for central regions', () => {
    // 'tailbone' is not lateralized, so a stray side is not carried through.
    expect(top('left coccyx')).toBe('tailbone');
  });

  it('offers no suggestion for unrecognizable scribble', () => {
    expect(matchBodyLocation('xzq###')).toEqual([]);
    expect(matchBodyLocation('')).toEqual([]);
    expect(matchBodyLocation('   ')).toEqual([]);
  });

  it('ranks the closest region first and caps the count', () => {
    const matches = matchBodyLocation('knee', 3);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches[0].label).toBe('knee');
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score);
  });

  describe('autofillBodyLocation — confidence-gated auto-fill', () => {
    it('fills a confident read (exact term or long-word typo)', () => {
      expect(autofillBodyLocation('left knee')).toBe('left knee');
      expect(autofillBodyLocation('lefr kṇee')).toBe('left knee');
      expect(autofillBodyLocation('lumbar')).toBe('lower back');
      expect(autofillBodyLocation('sholder')).toBe('shoulder');
    });

    it('keeps raw text (returns null) for a low-confidence match', () => {
      // A single typo in a 3-letter part ("hpi") is too uncertain to auto-fill,
      // even though it still surfaces as a match.
      expect(matchBodyLocation('rihgt hpi')[0]?.label).toBe('right hip');
      expect(autofillBodyLocation('rihgt hpi')).toBeNull();
    });

    it('returns null when there is no match at all', () => {
      expect(autofillBodyLocation('xzq###')).toBeNull();
      expect(autofillBodyLocation('')).toBeNull();
    });
  });

  it('does not invent a match for an unusual but plausible free-text answer', () => {
    // The reviewer keeps their own text; we simply do not force a bad snap.
    const matches = matchBodyLocation('left side of ribcage');
    for (const m of matches) expect(m.score).toBeGreaterThanOrEqual(0.5);
  });
});
