/**
 * Routing tests: render a synthetic sheet for one assessment, then confirm the
 * router picks that assessment over the other three candidates.
 */
import { describe, it, expect } from 'vitest';
import { routePage, scoreRead } from './route';
import { readSheet } from './reader';
import { renderSyntheticSheet } from './synth';
import { MSI_OMR_TEMPLATE } from '../../assessments/msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../../assessments/briefslanss/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../../assessments/frebaq/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../../assessments/phq4/omr-template';
import type { OmrTemplate } from '../../assessments/omr/types';

const ALL = [MSI_OMR_TEMPLATE, BRIEFSLANSS_OMR_TEMPLATE, FREBAQ_OMR_TEMPLATE, PHQ4_OMR_TEMPLATE];

/** Fill every field of a template with its highest bubble value. */
function fullAnswers(template: OmrTemplate): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const section of template.sections) {
    for (const row of section.rows) {
      for (const field of row.fields) {
        answers[field.key] = field.bubbles[field.bubbles.length - 1].value;
      }
    }
  }
  return answers;
}

describe('routePage', () => {
  for (const template of ALL) {
    it(`routes a filled ${template.id} sheet to its own template`, () => {
      const img = renderSyntheticSheet(template, fullAnswers(template), { scale: 3 });
      const route = routePage(img, ALL);

      expect(route.best).not.toBeNull();
      expect(route.best!.template.id).toBe(template.id);
      // The winning fit clears the runner-up by a clear margin.
      expect(route.candidates[0].score).toBeGreaterThan(route.candidates[1].score);
    });
  }

  it('exposes the full ranking, best first', () => {
    const img = renderSyntheticSheet(FREBAQ_OMR_TEMPLATE, fullAnswers(FREBAQ_OMR_TEMPLATE), { scale: 3 });
    const route = routePage(img, ALL);
    expect(route.candidates).toHaveLength(ALL.length);
    for (let i = 1; i < route.candidates.length; i += 1) {
      expect(route.candidates[i - 1].score).toBeGreaterThanOrEqual(route.candidates[i].score);
    }
  });

  it('scores a failed detection below any real read', () => {
    // A blank image with no fiducials can't be located → readSheet fails.
    const blank = { width: 200, height: 260, data: new Uint8Array(200 * 260).fill(255) };
    expect(scoreRead(readSheet(blank, MSI_OMR_TEMPLATE))).toBe(-Infinity);
  });
});
