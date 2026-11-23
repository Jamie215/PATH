/**
 * Smoke tests for every user flow, in a real browser against the built site.
 * Unit tests cover scoring; these check the pages work end to end: each
 * survey can be completed, its results show the right score, and the PDF
 * downloads. Each test gets a fresh browser context (an empty sessionStorage).
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SCREENERS } from '../src/assessments/screeners';
import { assessmentBySlug } from '../src/assessments/registry';

/**
 * Pick option `idx` (or the last one, if fewer) in every rating group,
 * including MSI follow-ups that only appear once a frequency is chosen.
 */
async function answerAll(page: Page, idx: number): Promise<void> {
  // Surveys render in the browser after load; wait for one before answering.
  await page.locator('.rating[role=radiogroup]').first().waitFor();
  const unanswered = page.locator('.rating[role=radiogroup]:not(:has([aria-checked=true]))');
  for (let guard = 0; guard < 50 && (await unanswered.count()) > 0; guard++) {
    const options = unanswered.first().getByRole('radio');
    await options.nth(Math.min(idx, (await options.count()) - 1)).click();
  }
}

/** Click a download button and check a real PDF arrives. */
async function expectPdf(page: Page, button: RegExp): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  return download.suggestedFilename();
}

/** Fail the test on any uncaught page error or console error. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.describe('screeners', () => {
  for (const def of SCREENERS) {
    const { title } = assessmentBySlug(def.slug);

    test(`${title}: survey → results → PDF`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${def.slug}/`);
      await expect(page.locator('h1')).toHaveText(title);

      if (def.areaField) {
        await page.locator('.area__input').fill('My Right Knee.');
        await page.getByRole('button', { name: 'Confirm' }).click();
        await expect(page.locator('.area-summary__text')).toContainText('my right knee');
      }

      // The top answer on every item gives the maximum score.
      await answerAll(page, 99);
      await page.getByRole('button', { name: 'See results' }).click();
      await page.waitForURL(`**/${def.slug}/results/`);
      await expect(page.locator('.score-card__value')).toHaveText(String(def.scoring.maxScore));
      if (def.areaField) await expect(page.locator('.area-body')).toHaveText('right knee');

      expect(await expectPdf(page, /Download results/)).toMatch(new RegExp(`^${def.report.filenamePrefix}`));
      expect(errors).toEqual([]);
    });
  }
});

test('Symptom Index: intake → survey → results with charts → PDF', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/msi/');
  await page.getByRole('radio', { name: /healthcare professional/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL('**/msi/survey/');
  await answerAll(page, 2); // Often · Quite Bothersome on every symptom
  await page.getByRole('button', { name: 'See results' }).click();
  await page.waitForURL('**/msi/results/');
  await expect(page.getByText('Screening results')).toBeVisible(); // professional-only
  await expect(page.locator('canvas')).toHaveCount(2);
  await expectPdf(page, /Download results/);
  expect(errors).toEqual([]);
});

/** Start Pain Classification (acute) as a patient or a professional. */
async function startPainClassification(page: Page, role: RegExp): Promise<void> {
  await page.goto('/pain-classification/');
  await page.getByRole('radio', { name: /Acute/ }).click();
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL('**/pain-classification/acute/');
}

test('Pain Classification, professional: manual scores → classification → PDF', async ({ page }) => {
  const errors = watchErrors(page);
  await startPainClassification(page, /healthcare professional/);

  // The workbook's worked example: MSI 20/10, S-LANSS 4, FreBAQ 0, PHQ-4 7.
  const scores = page.locator('input[type=number]');
  await expect(scores).toHaveCount(5);
  for (const [i, v] of [20, 10, 4, 0, 7].entries()) {
    await scores.nth(i).fill(String(v));
    await scores.nth(i).blur();
  }
  await page.getByRole('button', { name: /See results/ }).click();
  await page.waitForURL('**/pain-classification/results/');
  await expect(page.locator('main')).toContainText('Mood-Dominant');
  await expect(page.locator('main')).toContainText('65.7%');
  await expectPdf(page, /Download results/);
  expect(errors).toEqual([]);
});

test('Pain Classification: a partly filled test never reaches the results page', async ({ page }) => {
  await startPainClassification(page, /healthcare professional/);
  await page.locator('input[type=number]').first().fill('20'); // MSI somatic only
  await page.locator('input[type=number]').first().blur();
  await page.goto('/pain-classification/results/');
  await page.waitForURL('**/pain-classification/acute/');
});

test('Pain Classification, patient: four tests → score-free review → answers PDF', async ({ page }) => {
  const errors = watchErrors(page);
  await startPainClassification(page, /patient/);

  for (let step = 1; step <= 4; step++) {
    await expect(page.locator('.flow__title')).toContainText(`${step}.`);
    if (await page.locator('.area__input').count()) {
      await page.locator('.area__input').fill('neck');
      await page.getByRole('button', { name: 'Confirm' }).click();
    }
    await answerAll(page, 1);
    await page.getByRole('button', { name: step < 4 ? /Next test/ : /Finish & review/ }).click();
  }

  await page.waitForURL('**/pain-classification/review/');
  await expect(page.locator('main')).toContainText('Body Awareness');
  await expect(page.locator('main')).not.toContainText('Mood-Dominant'); // patients never see a classification
  await expectPdf(page, /Download my responses/);
  expect(errors).toEqual([]);
});

test('returning to the hub clears all patient data', async ({ page }) => {
  await page.goto('/phq4/');
  await answerAll(page, 0);
  await page.getByRole('button', { name: 'See results' }).click();
  await page.waitForURL('**/phq4/results/');
  await page.goto('/');
  const left = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('path:')));
  expect(left).toEqual([]);
});
