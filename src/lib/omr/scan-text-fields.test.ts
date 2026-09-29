/**
 * Print ↔ read alignment for the free-text regions.
 *
 * Each template's `scanTextFields` rects are hand-placed to cover where
 * `omr-sheet.ts` draws the matching fill-in blank / comment box, and nothing
 * else ties the two together. This generates every sheet and checks each crop
 * rect against the AcroForm widget the generator actually placed, so a layout
 * change that moves a field without updating its crop fails here instead of
 * silently cropping the wrong region from real scans.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { generateAnswerSheet } from '../omr-sheet';
import { MSI_OMR_TEMPLATE } from '../../assessments/msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../../assessments/briefslanss/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../../assessments/frebaq/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../../assessments/phq4/omr-template';

/** Slack (pt) allowed where a crop edge sits just inside the widget's edge. */
const TOLERANCE_PT = 4;
/** A crop may extend past its widget (e.g. for descenders), but not by more. */
const MAX_OVERHANG_PT = 30;

const TEMPLATES = [MSI_OMR_TEMPLATE, BRIEFSLANSS_OMR_TEMPLATE, FREBAQ_OMR_TEMPLATE, PHQ4_OMR_TEMPLATE];

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s scan text fields', (_id, template) => {
  it.each((template.scanTextFields ?? []).map((f) => [f.key, f] as const))(
    '%s crop covers the printed field on page 1',
    async (key, field) => {
      const doc = await PDFDocument.load(await generateAnswerSheet(template));
      const tf = doc.getForm().getField(key);
      expect(tf).toBeInstanceOf(PDFTextField);
      const widget = tf.acroField.getWidgets()[0];
      // The reader only crops page 1 of a scan.
      const pageRef = widget.P();
      expect(pageRef === undefined || pageRef === doc.getPage(0).ref).toBe(true);

      const { width: W, height: H } = template.page;
      const r = widget.getRectangle(); // pt, bottom-left origin
      const printed = { left: r.x, right: r.x + r.width, top: H - (r.y + r.height), bottom: H - r.y };
      const crop = {
        left: field.rect.x * W,
        right: (field.rect.x + field.rect.width) * W,
        top: field.rect.y * H,
        bottom: (field.rect.y + field.rect.height) * H,
      };

      // Covers the printed field…
      expect(crop.left).toBeLessThanOrEqual(printed.left + TOLERANCE_PT);
      expect(crop.right).toBeGreaterThanOrEqual(printed.right - TOLERANCE_PT);
      expect(crop.top).toBeLessThanOrEqual(printed.top + TOLERANCE_PT);
      expect(crop.bottom).toBeGreaterThanOrEqual(printed.bottom - TOLERANCE_PT);
      // …without straying far beyond it.
      expect(printed.left - crop.left).toBeLessThanOrEqual(MAX_OVERHANG_PT);
      expect(crop.right - printed.right).toBeLessThanOrEqual(MAX_OVERHANG_PT);
      expect(printed.top - crop.top).toBeLessThanOrEqual(MAX_OVERHANG_PT);
      expect(crop.bottom - printed.bottom).toBeLessThanOrEqual(MAX_OVERHANG_PT);
    },
  );
});
