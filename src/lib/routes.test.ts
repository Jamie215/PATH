import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessmentUrl, MSI_SURVEY, PAIN_CLASSIFICATION, resultsUrl } from './routes';

/** The src/pages file Astro serves for a route like `/msi/survey/`. */
function pageFor(url: string): string {
  const path = url.split('?')[0].replace(/^\/|\/$/g, '');
  const base = new URL('../pages/', import.meta.url);
  const asFile = new URL(`${path}.astro`, base);
  return existsSync(asFile) ? asFile.pathname : new URL(`${path ? `${path}/` : ''}index.astro`, base).pathname;
}

describe('routes', () => {
  const urls = [
    ...['msi', 'frebaq', 'phq4', 'briefslanss'].flatMap((s) => [assessmentUrl(s), resultsUrl(s)]),
    MSI_SURVEY,
    PAIN_CLASSIFICATION.intake,
    PAIN_CLASSIFICATION.acute,
    PAIN_CLASSIFICATION.edit('msi'),
    PAIN_CLASSIFICATION.review,
    PAIN_CLASSIFICATION.results,
  ];

  it.each(urls)('%s has a page', (url) => {
    expect(existsSync(pageFor(url))).toBe(true);
  });
});
