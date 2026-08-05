/**
 * Round-trip tests for the PDF-form ingest adapter: generate a blank sheet,
 * fill its interactive radio groups the way a computer user would, then read
 * it back and assert the recovered response — plus the blank/conditional
 * warning behavior it shares with the scan reader.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateAnswerSheet, generateCombinedAnswerSheets } from '../omr-sheet';
import { readPdfForm, readCombinedPdfForm } from './pdf-form-reader';
import { FREBAQ_OMR_TEMPLATE } from '../../assessments/frebaq/omr-template';
import { MSI_OMR_TEMPLATE } from '../../assessments/msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../../assessments/briefslanss/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../../assessments/phq4/omr-template';
import type { OmrTemplate } from '../../assessments/omr/types';

/** Generate the template's sheet, select the given options, return the bytes. */
async function fillSheet(
  template: OmrTemplate,
  selections: Record<string, string>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await generateAnswerSheet(template));
  const form = doc.getForm();
  for (const [key, option] of Object.entries(selections)) {
    form.getRadioGroup(key).select(option);
  }
  return doc.save();
}

const frebaqKeys = FREBAQ_OMR_TEMPLATE.sections[0].rows.map((r) => r.fields[0].key);

describe('readPdfForm', () => {
  it('recovers every selected value from a fully-filled FreBAQ sheet', async () => {
    const picks = [0, 4, 2, 1, 3, 4];
    const selections = Object.fromEntries(frebaqKeys.map((k, i) => [k, String(picks[i])]));
    const bytes = await fillSheet(FREBAQ_OMR_TEMPLATE, selections);

    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.attention).toEqual([]);
    expect(result.response).toEqual(
      Object.fromEntries(frebaqKeys.map((k, i) => [k, picks[i]])),
    );
  });

  it('flags a left-blank field but still returns the answered ones', async () => {
    // Fill all but the third statement.
    const answered = frebaqKeys.filter((_, i) => i !== 2);
    const selections = Object.fromEntries(answered.map((k) => [k, '2']));
    const bytes = await fillSheet(FREBAQ_OMR_TEMPLATE, selections);

    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);

    expect(result.ok).toBe(true);
    expect(result.response[frebaqKeys[2]]).toBeUndefined();
    expect(result.attention).toContain(frebaqKeys[2]);
    expect(result.warnings.length).toBe(1);
    // The answered fields still come through.
    for (const k of answered) expect(result.response[k]).toBe(2);
  });

  it("honors MSI's conditional follow-up: freq 0 ignores bothersomeness", async () => {
    const row0 = MSI_OMR_TEMPLATE.sections[0].rows[0];
    const freqKey = row0.fields[0].key; // *_freq
    const intKey = row0.fields[1].key; // *_interference
    // Frequency "Never" (0), bothersomeness deliberately left blank.
    const bytes = await fillSheet(MSI_OMR_TEMPLATE, { [freqKey]: '0' });

    const result = await readPdfForm(bytes, MSI_OMR_TEMPLATE);

    expect(result.response[freqKey]).toBe(0);
    expect(result.response[intKey]).toBeUndefined();
    // Not marking bothersomeness after "Never" is correct — no warning for it.
    expect(result.attention).not.toContain(intKey);
  });

  it("flags missing bothersomeness when MSI frequency is > 0", async () => {
    const row0 = MSI_OMR_TEMPLATE.sections[0].rows[0];
    const freqKey = row0.fields[0].key;
    const intKey = row0.fields[1].key;
    const bytes = await fillSheet(MSI_OMR_TEMPLATE, { [freqKey]: '2' });

    const result = await readPdfForm(bytes, MSI_OMR_TEMPLATE);

    expect(result.response[freqKey]).toBe(2);
    expect(result.attention).toContain(intKey);
  });

  it('reads name, date, and comments text fields back', async () => {
    const doc = await PDFDocument.load(await generateAnswerSheet(FREBAQ_OMR_TEMPLATE));
    const form = doc.getForm();
    form.getRadioGroup(frebaqKeys[0]).select('1'); // at least one answer, so ok
    form.getTextField('patient_name').setText('Jane Doe');
    form.getTextField('patient_date').setText('2026-07-27');
    form.getTextField('bothersome_area').setText('left knee');
    form.getTextField('other_comments').setText('Worse in the mornings.');
    const bytes = await doc.save();

    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);

    expect(result.ok).toBe(true);
    expect(result.text?.patient_name).toBe('Jane Doe');
    expect(result.text?.patient_date).toBe('2026-07-27');
    expect(result.text?.bothersome_area).toBe('left knee');
    expect(result.text?.other_comments).toBe('Worse in the mornings.');
  });

  it('omits the text map when no text fields are filled', async () => {
    const selections = Object.fromEntries(frebaqKeys.map((k) => [k, '0']));
    const bytes = await fillSheet(FREBAQ_OMR_TEMPLATE, selections);
    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);
    expect(result.text).toBeUndefined();
  });

  it('rejects an interactive sheet with nothing filled in', async () => {
    const bytes = await generateAnswerSheet(FREBAQ_OMR_TEMPLATE); // untouched
    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no answers filled in/i);
  });

  it('rejects a PDF that has no form fields at all', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const result = await readPdfForm(bytes, FREBAQ_OMR_TEMPLATE);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/results report/i);
  });

  it('rejects a sheet generated for a different assessment', async () => {
    // A fully-filled FreBAQ sheet, read against the MSI template. The stamped
    // form id must round-trip through generate → read and trip the mismatch.
    const selections = Object.fromEntries(frebaqKeys.map((k) => [k, '1']));
    const bytes = await fillSheet(FREBAQ_OMR_TEMPLATE, selections);

    const result = await readPdfForm(bytes, MSI_OMR_TEMPLATE);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/different assessment/i);
  });

  it('rejects a file that is not a PDF', async () => {
    const result = await readPdfForm(new TextEncoder().encode('not a pdf'), FREBAQ_OMR_TEMPLATE);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a readable pdf/i);
  });
});

/** Pick a valid selection for every field of a template — the last (highest)
 *  bubble value per field, so an MSI frequency is > 0 and its bothersomeness
 *  follow-up is also answered (no conditional warnings). */
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

const ALL_TEMPLATES = [
  MSI_OMR_TEMPLATE,
  BRIEFSLANSS_OMR_TEMPLATE,
  FREBAQ_OMR_TEMPLATE,
  PHQ4_OMR_TEMPLATE,
];

describe('readCombinedPdfForm', () => {
  it('splits a full "all tests" PDF into one result per assessment', async () => {
    const entries = ALL_TEMPLATES.map((template) => ({
      template,
      answers: fullAnswers(template),
    }));
    const bytes = await generateCombinedAnswerSheets(entries);

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.children.map((c) => c.templateId)).toEqual(
      ALL_TEMPLATES.map((t) => t.id),
    );
    // Each child's response is keyed by bare scorer keys and carries the answers.
    const frebaqChild = result.children.find((c) => c.templateId === FREBAQ_OMR_TEMPLATE.id)!;
    expect(frebaqChild.prefix).toMatch(/^t\d+_$/);
    for (const [key, value] of Object.entries(fullAnswers(FREBAQ_OMR_TEMPLATE))) {
      expect(frebaqChild.result.response[key]).toBe(value);
    }
  });

  it('returns only the assessments that were actually filled (partial upload)', async () => {
    // A combined document laid out with all four sheets, but only two filled in.
    const entries = ALL_TEMPLATES.map((template) => ({
      template,
      answers:
        template === MSI_OMR_TEMPLATE || template === PHQ4_OMR_TEMPLATE
          ? fullAnswers(template)
          : undefined,
    }));
    const bytes = await generateCombinedAnswerSheets(entries);

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.children.map((c) => c.templateId).sort()).toEqual(
      [MSI_OMR_TEMPLATE.id, PHQ4_OMR_TEMPLATE.id].sort(),
    );
  });

  it('carries free-text (comments / bothersome area) through per child', async () => {
    const entries = ALL_TEMPLATES.map((template) => ({
      template,
      answers: {
        ...fullAnswers(template),
        ...(template === FREBAQ_OMR_TEMPLATE
          ? { bothersome_area: 'left knee', other_comments: 'Worse at night.' }
          : {}),
      },
    }));
    const bytes = await generateCombinedAnswerSheets(entries);

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frebaq = result.children.find((c) => c.templateId === FREBAQ_OMR_TEMPLATE.id)!;
    expect(frebaq.result.text?.bothersome_area).toBe('left knee');
    expect(frebaq.result.text?.other_comments).toBe('Worse at night.');
  });

  it('accepts a lone single-assessment sheet dropped into the combined reader', async () => {
    const doc = await PDFDocument.load(await generateAnswerSheet(MSI_OMR_TEMPLATE));
    const form = doc.getForm();
    const answers = fullAnswers(MSI_OMR_TEMPLATE);
    for (const [key, value] of Object.entries(answers)) {
      form.getRadioGroup(key).select(String(value));
    }
    const bytes = await doc.save();

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.children).toHaveLength(1);
    expect(result.children[0].templateId).toBe(MSI_OMR_TEMPLATE.id);
    expect(result.children[0].prefix).toBe('');
  });

  it('rejects a completed-tests PDF with nothing filled in', async () => {
    const entries = ALL_TEMPLATES.map((template) => ({ template }));
    const bytes = await generateCombinedAnswerSheets(entries);

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no.*answers|filled in/i);
  });

  it('rejects a PDF with no form fields', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const result = await readCombinedPdfForm(bytes, ALL_TEMPLATES);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/results report|no answer fields/i);
  });
});
