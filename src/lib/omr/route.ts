/**
 * Page routing for combined scan uploads.
 *
 * A photographed/scanned "completed tests" packet arrives as one image per
 * sheet, but — unlike a filled PDF — a photo carries no machine-readable form
 * id, so we can't know which assessment a page is just by looking at it. This
 * module reads a page against every candidate template and scores the fit, so
 * the UI can pre-select the most likely assessment and let the reviewer confirm
 * or override it before the page enters review.
 *
 * It builds only on the DOM-free `readSheet`, so it's unit-testable headlessly
 * against synthetic sheets.
 */
import type { GrayImage, OmrReadResult } from './types';
import type { OmrTemplate } from '../../assessments/omr/types';
import { readSheet } from './reader';

/** One template's read of a page, with a fit score (higher = better match). */
export interface RouteCandidate {
  template: OmrTemplate;
  score: number;
  result: OmrReadResult;
}

export interface PageRoute {
  /** Candidates, best fit first. */
  candidates: RouteCandidate[];
  /** The best candidate, or null when no template fits confidently — the page
   *  is probably not one of these answer sheets, so the UI defaults to "skip". */
  best: RouteCandidate | null;
}

/**
 * Fit score for a read: reward confidently resolved single-mark fields (the
 * hallmark of the *correct* grid landing on real answers), and lightly penalize
 * ambiguous multi-mark reads (what a *wrong* grid tends to produce when its
 * bubble coordinates fall on unrelated print). A failed detection scores below
 * everything so it never wins.
 */
export function scoreRead(result: OmrReadResult): number {
  if (!result.ok) return -Infinity;
  let ok = 0;
  let ambiguous = 0;
  let confidence = 0;
  for (const field of result.fields) {
    if (field.status === 'ok') {
      ok += 1;
      confidence += field.confidence;
    } else if (field.status === 'ambiguous') {
      ambiguous += 1;
    }
  }
  return ok + 0.5 * confidence - 0.5 * ambiguous;
}

/** Minimum score for the best candidate to be offered as a confident match;
 *  below it, a page is treated as "couldn't auto-detect" (default: skip). */
const MIN_CONFIDENT_SCORE = 1;

/**
 * Read one page against every template and rank the fits. The `result` on each
 * candidate is a full `readSheet` outcome (warped image, text crops, response),
 * so the chosen one feeds review directly with no re-read.
 */
export function routePage(img: GrayImage, templates: OmrTemplate[]): PageRoute {
  const candidates: RouteCandidate[] = templates.map((template) => {
    const result = readSheet(img, template);
    return { template, score: scoreRead(result), result };
  });
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return {
    candidates,
    best: top && top.score >= MIN_CONFIDENT_SCORE ? top : null,
  };
}
