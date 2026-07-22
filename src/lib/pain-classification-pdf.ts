/**
 * Pain Classification (acute) PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable. Same layout conventions as the per-assessment reports:
 * origin at bottom-left, content laid out top-to-bottom via a `y` cursor.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  const doc = await PDFDocument.create();
  doc.setTitle('Pain Classification Results');
  doc.setSubject('Pain Classification (acute) — composite results');
  doc.setProducer('PATH — Pain Assessment Tools Hub');
  doc.setCreator('PATH');
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    font,
    fontBold,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN_TOP,
    pageNum: 1,
  };

  drawHeader(ctx);
  drawTitle(ctx, input.patientName);
  drawHeadline(ctx, input);
  drawProbabilities(ctx, input.probs, input.classification);
  drawInputs(ctx, input.rows);
  drawInterpretationNote(ctx);

  const total = ctx.doc.getPageCount();
  for (let i = 0; i < total; i += 1) {
    drawFooter(ctx.doc.getPage(i), font, i + 1, total);
  }

  return doc.save();
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const safe = patientName
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return safe
    ? `pain_classification_Results_${safe}_${today}.pdf`
    : `pain_classification_Results_${today}.pdf`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const MARGIN_X = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

const COLOR_PRIMARY = rgb(0.31, 0.149, 0.514); // #4F2683
const COLOR_PRIMARY_TINT = rgb(0.722, 0.624, 0.82); // #B89FD1
const COLOR_TEXT = rgb(0.122, 0.122, 0.122); // #1F1F1F
const COLOR_MUTED = rgb(0.361, 0.361, 0.361); // #5C5C5C
const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533); // #888
const COLOR_BORDER = rgb(0.898, 0.898, 0.898); // #E5E5E5
const COLOR_TINT = rgb(0.961, 0.941, 0.98); // #F5F0FA
const COLOR_WHITE = rgb(1, 1, 1);

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  y: number;
  pageNum: number;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.pageNum += 1;
    ctx.y = PAGE_H - MARGIN_TOP;
    drawHeader(ctx, { compact: true });
  }
}

function moveDown(ctx: Ctx, dy: number): void {
  ctx.y -= dy;
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  ctx.page.drawText(text, {
    x: opts.x ?? MARGIN_X,
    y: ctx.y,
    size,
    font,
    color: opts.color ?? COLOR_TEXT,
  });
}

function drawRightText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const w = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, {
    x: MARGIN_X + CONTENT_W - w,
    y: ctx.y,
    size,
    font,
    color: opts.color ?? COLOR_TEXT,
  });
}

function drawRule(ctx: Ctx, color = COLOR_BORDER, thickness = 0.5): void {
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: MARGIN_X + CONTENT_W, y: ctx.y },
    thickness,
    color,
  });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current.length > 0) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Section drawers
// ---------------------------------------------------------------------------

function drawHeader(ctx: Ctx, opts: { compact?: boolean } = {}): void {
  const startY = ctx.y;
  drawText(ctx, 'PATH', { bold: true, size: 14, color: COLOR_PRIMARY });
  if (!opts.compact) {
    moveDown(ctx, 12);
    drawText(ctx, 'Pain Assessment Tools Hub', { size: 9, color: COLOR_MUTED });
  }

  const dateStr = new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateWidth = ctx.font.widthOfTextAtSize(dateStr, 9);
  ctx.page.drawText(dateStr, {
    x: MARGIN_X + CONTENT_W - dateWidth,
    y: startY,
    size: 9,
    font: ctx.font,
    color: COLOR_MUTED,
  });

  moveDown(ctx, opts.compact ? 14 : 18);
  drawRule(ctx);
  moveDown(ctx, 20);
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number): void {
  const text = `Page ${pageNum} of ${total} · Generated by PATH`;
  const width = font.widthOfTextAtSize(text, 8);
  page.drawText(text, { x: (PAGE_W - width) / 2, y: 30, size: 8, font, color: COLOR_SUBTLE });
}

function drawTitle(ctx: Ctx, patientName: string): void {
  drawText(ctx, 'Pain Classification', { bold: true, size: 18, color: COLOR_TEXT });
  moveDown(ctx, 22);
  drawText(ctx, 'Acute pathway — composite results report', { size: 11, color: COLOR_MUTED });
  moveDown(ctx, 22);

  if (patientName) {
    drawText(ctx, 'Patient', { size: 8, color: COLOR_MUTED, bold: true });
    moveDown(ctx, 14);
    drawText(ctx, patientName, { bold: true, size: 14, color: COLOR_PRIMARY });
    moveDown(ctx, 24);
  }
}

function drawSectionHeading(ctx: Ctx, title: string): void {
  ensureSpace(ctx, 40);
  drawText(ctx, title, { bold: true, size: 13, color: COLOR_TEXT });
  moveDown(ctx, 8);
  drawRule(ctx, COLOR_PRIMARY, 1);
  moveDown(ctx, 16);
}

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

function drawInterpretationNote(ctx: Ctx): void {
  const note =
    'This composite classifies the acute pain presentation from five standardised sub-scores ' +
    '(MSI Somatic and Central, Brief S-LANSS, FreBAQ, and PHQ-4) using a multinomial model. ' +
    'Probabilities sum to 100% across the four categories. This is a screening result, not a ' +
    'diagnosis, and should be interpreted alongside clinical judgement.';
  const lines = wrapText(note, CONTENT_W, ctx.font, 9);
  ensureSpace(ctx, lines.length * 13 + 8);
  drawRule(ctx);
  moveDown(ctx, 14);
  for (const line of lines) {
    drawText(ctx, line, { size: 9, color: COLOR_MUTED });
    moveDown(ctx, 13);
  }
}
