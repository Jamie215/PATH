/**
 * Pre-filled answer sheets (the patient's "Download my responses" PDF) must
 * show their answers in any PDF viewer, not only in viewers that draw
 * pre-selected radio buttons. So each answer is both a form value (read back
 * by the upload reader) and a solid mark printed on the page; and the radio
 * buttons carry the standard ZapfDingbats description viewers redraw from.
 */
import { describe, it, expect } from 'vitest';
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRadioGroup,
  type PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import { generateAnswerSheet, generateCombinedAnswerSheets } from './omr-sheet';
import { readCombinedPdfForm } from './omr/pdf-form-reader';
import { PHQ4_OMR_TEMPLATE } from '../assessments/phq4/omr-template';
import { MSI_OMR_TEMPLATE } from '../assessments/msi/omr-template';
import type { OmrTemplate } from '../assessments/omr/types';

/** Decoded content of one page. */
function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => doc.context.lookup(ref))
    : [contents];
  return streams
    .map((s) => new TextDecoder().decode(decodePDFRawStream(s as PDFRawStream).decode()))
    .join('\n');
}

/**
 * Centres (pt, bottom-left origin) of the solid black circles on a page. A
 * filled circle is drawn as `0 0 0 rg … <x-r> <y> m … f`, starting at its
 * leftmost point, so its centre y is the start y.
 */
function filledCircleStarts(content: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const re = /0 0 0 rg\n0 w\n\[\] 0 d\nq\n([\d.]+) ([\d.]+) m\n[\s\S]*?\nQ\nf\n/g;
  for (const m of content.matchAll(re)) out.push({ x: Number(m[1]), y: Number(m[2]) });
  return out;
}

/** Whether a solid mark sits in the given bubble of a template's page. */
function hasMark(marks: { x: number; y: number }[], t: OmrTemplate, key: string, value: number): boolean {
  const field = t.sections.flatMap((s) => s.rows).flatMap((r) => r.fields).find((f) => f.key === key)!;
  const bubble = field.bubbles.find((b) => b.value === value)!;
  const cx = bubble.center.x * t.page.width;
  const cy = t.page.height - bubble.center.y * t.page.height;
  const r = t.bubbleRadius * t.page.width;
  return marks.some((m) => Math.abs(m.y - cy) < 0.5 && m.x < cx && m.x > cx - r);
}

const PHQ4_ANSWERS = {
  nervousOrAnxious_exp: 2,
  worrying_exp: 0,
  depressedOrHopeless_exp: 3,
  littleInterestOrPleasure_exp: 1,
};
const MSI_ANSWERS = { sharp_freq: 2, sharp_interference: 3, dull_freq: 0 };

async function completedPdf(): Promise<PDFDocument> {
  const bytes = await generateCombinedAnswerSheets([
    { template: MSI_OMR_TEMPLATE, answers: MSI_ANSWERS },
    { template: PHQ4_OMR_TEMPLATE, answers: { ...PHQ4_ANSWERS, other_comments: 'note' } },
  ]);
  return PDFDocument.load(bytes);
}

describe('pre-filled answer sheets', () => {
  it('print a solid mark in every answered bubble, and only there', async () => {
    const doc = await completedPdf();
    const msiMarks = filledCircleStarts(pageContent(doc, 0));
    const phqMarks = filledCircleStarts(pageContent(doc, 1));

    for (const [key, value] of Object.entries(MSI_ANSWERS)) {
      expect(hasMark(msiMarks, MSI_OMR_TEMPLATE, key, value), key).toBe(true);
    }
    for (const [key, value] of Object.entries(PHQ4_ANSWERS)) {
      expect(hasMark(phqMarks, PHQ4_OMR_TEMPLATE, key, value), key).toBe(true);
      // Other bubbles in the same question stay empty.
      for (const other of [0, 1, 2, 3].filter((v) => v !== value)) {
        expect(hasMark(phqMarks, PHQ4_OMR_TEMPLATE, key, other), `${key}=${other}`).toBe(false);
      }
    }
  });

  it('leave blank sheets unmarked', async () => {
    const doc = await PDFDocument.load(await generateAnswerSheet(PHQ4_OMR_TEMPLATE));
    const marks = filledCircleStarts(pageContent(doc, 0));
    for (const key of Object.keys(PHQ4_ANSWERS)) {
      for (const v of [0, 1, 2, 3]) expect(hasMark(marks, PHQ4_OMR_TEMPLATE, key, v)).toBe(false);
    }
  });

  it('still carry the answers as form values for the upload reader', async () => {
    const doc = await completedPdf();
    const read = await readCombinedPdfForm(await doc.save(), [MSI_OMR_TEMPLATE, PHQ4_OMR_TEMPLATE]);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const phq = read.children.find((c) => c.templateId === PHQ4_OMR_TEMPLATE.id)!;
    expect(phq.result.response).toEqual(PHQ4_ANSWERS);
    const msi = read.children.find((c) => c.templateId === MSI_OMR_TEMPLATE.id)!;
    expect(msi.result.response).toMatchObject(MSI_ANSWERS);
  });

  it('describe radio buttons the standard way, so viewers that redraw them show a dot', async () => {
    const doc = await completedPdf();
    const radios = doc.getForm().getFields().filter((f) => f instanceof PDFRadioGroup);
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(radio.acroField.getDefaultAppearance()).toBe('/ZaDb 0 Tf 0 g');
      for (const widget of radio.acroField.getWidgets()) {
        expect(widget.getAppearanceCharacteristics()?.dict.get(PDFName.of('CA'))?.toString()).toBe('(l)');
      }
    }
  });
});
