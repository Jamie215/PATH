import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summarizeChild } from './summary';
import { keys, set as storeSet } from '../../lib/storage';
import { fakeSessionStorage } from '../../lib/__fixtures__/session-storage';

beforeEach(() => vi.stubGlobal('window', { sessionStorage: fakeSessionStorage() }));
afterEach(() => vi.unstubAllGlobals());

describe('summarizeChild', () => {
  it('reads a screener answer back as its label', () => {
    storeSet(keys.response('phq4'), { nervousOrAnxious_exp: 2, other_comments: 'tired' });
    const s = summarizeChild('phq4');
    expect(s.rows[0]).toEqual({ question: 'Feeling nervous, anxious, or on edge', answer: 'More than half the days' });
    expect(s.rows[1].answer).toBeNull(); // unanswered
    expect(s.comments).toBe('tired');
    expect(s.area).toBeNull();
  });

  it('words FreBAQ items around the stored area', () => {
    storeSet(keys.response('frebaq'), { notPart_exp: 4, bothersome_area: 'hands' });
    const s = summarizeChild('frebaq');
    expect(s.area).toBe('hands');
    expect(s.rows[0].question).toBe('My hands feel as though they are not part of the rest of my body.');
    expect(s.rows[0].answer).toBe('Always');
  });

  it('pairs MSI frequency with bothersomeness only when the symptom occurs', () => {
    storeSet(keys.response('msi'), { sharp_freq: 2, sharp_interference: 3, dull_freq: 0 });
    const s = summarizeChild('msi');
    expect(s.rows[0]).toEqual({ question: 'Sharp or shooting pain', answer: 'Often · Quite Bothersome' });
    expect(s.rows[1].answer).toBe('Never');
  });

  it('returns no rows for an unknown slug', () => {
    expect(summarizeChild('nope').rows).toEqual([]);
  });
});
