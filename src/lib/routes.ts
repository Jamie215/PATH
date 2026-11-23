/**
 * Page URLs, so links and redirects don't each spell out a path. The files
 * under src/pages/ define these routes; keep the two in step.
 */

/** Hub home. Landing here always clears patient data (lib/session-clear). */
export const HOME = '/';

/** An assessment's first page (intake or survey), e.g. `/frebaq/`. */
export const assessmentUrl = (slug: string): string => `/${slug}/`;

/** An assessment's standalone results page, e.g. `/frebaq/results/`. */
export const resultsUrl = (slug: string): string => `/${slug}/results/`;

/** MSI's survey, which follows its role intake. */
export const MSI_SURVEY = '/msi/survey/';

/** Pages of the Pain Classification composite. */
export const PAIN_CLASSIFICATION = {
  /** Intake: pain type and role. */
  intake: '/pain-classification/',
  /** Acute pathway: patient walk-through or professional collection page. */
  acute: '/pain-classification/acute/',
  /** Reopen the acute pathway on one test to edit it. */
  edit: (slug: string): string => `/pain-classification/acute/?edit=${slug}`,
  /** Patient's score-free review of their answers. */
  review: '/pain-classification/review/',
  /** Professional's classification results. */
  results: '/pain-classification/results/',
} as const;
