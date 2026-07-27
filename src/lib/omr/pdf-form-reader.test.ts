/**
 * Round-trip tests for the PDF-form ingest adapter: generate a blank sheet,
 * fill its interactive radio groups the way a computer user would, then read
 * it back and assert the recovered response — plus the blank/conditional
 * warning behavior it shares with the scan reader.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateAnswerSheet } from '../omr-sheet';
import { readPdfForm } from './pdf-form-reader';
import { FREBAQ_OMR_TEMPLATE } from '../../assessments/frebaq/omr-template';
import { MSI_OMR_TEMPLATE } from '../../assessments/msi/omr-template';
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
    expect(result.error).toMatch(/no fillable answer fields/i);
  });

  it('rejects a file that is not a PDF', async () => {
    const result = await readPdfForm(new TextEncoder().encode('not a pdf'), FREBAQ_OMR_TEMPLATE);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a readable pdf/i);
  });
});
