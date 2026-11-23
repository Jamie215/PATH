import { describe, expect, it } from 'vitest';
import { keys } from './storage';

describe('storage keys', () => {
  it('keeps the key names every page reads and writes', () => {
    expect(keys.response('frebaq')).toBe('frebaq:response');
    expect(keys.result('msi')).toBe('msi:result');
    expect(keys.patientName('phq4')).toBe('phq4:patientName');
    expect(keys.role('pain-classification')).toBe('pain-classification:role');
  });
});
