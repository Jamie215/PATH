/**
 * Pain Classification (acute) PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable. Shared layout/primitives live in ./pdf/report-kit; the
 * headline banner, probability bars, and collected-inputs sections below are
 * specific to this composite report.
 */
import {
  buildFilename as kitBuildFilename,
  createReport,
  drawNote,
  drawRightText,
  drawSectionHeading,
  drawText,
  drawTitle,
  ensureSpace,
  finalizeReport,
  moveDown,
  wrapText,
  COLOR_BORDER,
  COLOR_MUTED,
  COLOR_PRIMARY,
  COLOR_PRIMARY_TINT,
  COLOR_SUBTLE,
  COLOR_TEXT,
  COLOR_WHITE,
  CONTENT_W,
  MARGIN_X,
  type Ctx,
} from './pdf/report-kit';
import { rgb } from 'pdf-lib';

export interface PDFProb {
  category: string;
  prob: number; // 0–1
}

export interface PDFInputRow {
  shortName: string;
  entries: [string, number][];
  comment: string;
}

export interface PDFInput {
  classification: string;
  /** Probabilities, expected already sorted high → low. */
  probs: PDFProb[];
  rows: PDFInputRow[];
  patientName: string;
}

export async function generatePainClassificationReport(input: PDFInput): Promise<Uint8Array> {
  const ctx = await createReport({
    title: 'Pain Classification Results',
    subject: 'Pain Classification (acute) — composite results',
  });

  drawTitle(ctx, {
    title: 'Pain Classification',
    subtitle: 'Acute pathway — composite results report',
    patientName: input.patientName,
  });
  drawHeadline(ctx, input);
  drawProbabilities(ctx, input.probs, input.classification);
  drawInputs(ctx, input.rows);
  drawNote(
    ctx,
    'This composite classifies the acute pain presentation from five standardised sub-scores ' +
      '(Symptom Index Somatic and Central, Sensory Profile, Body Awareness, and Anxiety & Depression) using a multinomial model. ' +
      'Probabilities sum to 100% across the four categories. This is a screening result, not a ' +
      'diagnosis, and should be interpreted alongside clinical judgement.',
    { rule: true },
  );

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  return kitBuildFilename('pain_classification_Results', patientName);
}

// ---------------------------------------------------------------------------
// Pain-classification-specific sections
// ---------------------------------------------------------------------------

/** Filled purple banner with the predicted category + its probability. */
function drawHeadline(ctx: Ctx, input: PDFInput): void {
  const cardH = 78;
  ensureSpace(ctx, cardH + 12);
  const cardTop = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: cardTop - cardH,
    width: CONTENT_W,
    height: cardH,
    color: COLOR_PRIMARY,
  });

  const topProb = input.probs.find((p) => p.category === input.classification)?.prob ?? 0;
  ctx.page.drawText('MOST LIKELY PRESENTATION', {
    x: MARGIN_X + 18,
    y: cardTop - 24,
    size: 8,
    font: ctx.fontBold,
    color: rgb(0.85, 0.8, 0.92),
  });
  ctx.page.drawText(input.classification, {
    x: MARGIN_X + 18,
    y: cardTop - 46,
    size: 18,
    font: ctx.fontBold,
    color: COLOR_WHITE,
  });
  ctx.page.drawText(`${(topProb * 100).toFixed(1)}% probability`, {
    x: MARGIN_X + 18,
    y: cardTop - 64,
    size: 10,
    font: ctx.font,
    color: rgb(0.9, 0.87, 0.96),
  });

  moveDown(ctx, cardH + 20);
}

function drawProbabilities(ctx: Ctx, probs: PDFProb[], classification: string): void {
  drawSectionHeading(ctx, 'Category probabilities');
  for (const p of probs) {
    const top = p.category === classification;
    ensureSpace(ctx, 30);
    drawText(ctx, p.category, { size: 10, bold: top, color: top ? COLOR_TEXT : COLOR_MUTED });
    drawRightText(ctx, `${(p.prob * 100).toFixed(1)}%`, { size: 10, bold: true });
    moveDown(ctx, 8);

    // Track + filled bar
    const barY = ctx.y - 8;
    ctx.page.drawRectangle({ x: MARGIN_X, y: barY, width: CONTENT_W, height: 6, color: COLOR_BORDER });
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: barY,
      width: Math.max(0, Math.min(1, p.prob)) * CONTENT_W,
      height: 6,
      color: top ? COLOR_PRIMARY : COLOR_PRIMARY_TINT,
    });
    moveDown(ctx, 22);
  }
  moveDown(ctx, 4);
}

function drawInputs(ctx: Ctx, rows: PDFInputRow[]): void {
  drawSectionHeading(ctx, 'Collected inputs');
  for (const row of rows) {
    ensureSpace(ctx, 40);
    drawText(ctx, row.shortName, { bold: true, size: 11, color: COLOR_TEXT });
    moveDown(ctx, 16);
    for (const [label, val] of row.entries) {
      drawText(ctx, label, { x: MARGIN_X + 12, size: 10, color: COLOR_MUTED });
      drawRightText(ctx, String(val), { size: 10, bold: true });
      moveDown(ctx, 15);
    }
    if (row.comment) {
      const lines = wrapText(row.comment, CONTENT_W - 12, ctx.font, 9);
      for (const line of lines) {
        ensureSpace(ctx, 13);
        drawText(ctx, line, { x: MARGIN_X + 12, size: 9, color: COLOR_SUBTLE });
        moveDown(ctx, 13);
      }
    }
    moveDown(ctx, 10);
  }
}
