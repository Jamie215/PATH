/**
 * Every single-total screener the app runs, in Pain Classification order.
 * Adding one to this list gives it a survey page, a results page and a PDF
 * report; wiring it into the composite is a separate entry in
 * pain-classification/config.ts.
 */
import type { ScreenerDefinition } from './screening';
import { BRIEFSLANSS } from './briefslanss/definition';
import { FREBAQ } from './frebaq/definition';
import { PHQ4 } from './phq4/definition';

export const SCREENERS: readonly ScreenerDefinition[] = [BRIEFSLANSS, FREBAQ, PHQ4];

/** The screener for `slug`, or undefined if it isn't one (e.g. `msi`). */
export function findScreener(slug: string): ScreenerDefinition | undefined {
  return SCREENERS.find((s) => s.slug === slug);
}

/** The screener for `slug`. Throws on an unknown slug so a typo fails loudly. */
export function screenerBySlug(slug: string): ScreenerDefinition {
  const found = findScreener(slug);
  if (!found) throw new Error(`Unknown screener slug: ${slug}`);
  return found;
}
