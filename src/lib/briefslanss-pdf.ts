/**
 * briefSLANSS PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains
 * selectable and searchable in the output.
 *
 * Page layout uses pdf-lib's native coordinate system (origin at
 * bottom-left). Content is laid out top-to-bottom by tracking a
 * `y` cursor and advancing downward as elements are drawn.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { briefSLANSSResult } from '../assessments/briefslanss/scoring';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PDFInput {
  result: briefSLANSSResult;
  patientName: string;
}

export async function generateBriefSLANSSReport(input: PDFInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('briefSLANSS Results');
  doc.setSubject('briefSLANSS — clinical screening results');
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
  drawScoreCard(ctx, input.result);
  drawInterpretationNote(ctx);
  drawComments(ctx, input.result.comments);

  // Stamp every page's footer once we know the total page count
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
  return safe ? `briefSLANSS_Results_${safe}_${today}.pdf` : `briefSLANSS_Results_${today}.pdf`;
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

const NEUROPATHIC_THRESHOLD = 3; // matches scoring.ts: neuropathic when total > 2

const COLOR_PRIMARY = rgb(0.31, 0.149, 0.514); // #4F2683
const COLOR_TEXT = rgb(0.122, 0.122, 0.122);   // #1F1F1F
const COLOR_MUTED = rgb(0.361, 0.361, 0.361);  // #5C5C5C
const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533); // #888
const COLOR_BORDER = rgb(0.898, 0.898, 0.898); // #E5E5E5
const COLOR_TINT = rgb(0.961, 0.941, 0.980);   // #F5F0FA

const COLOR_AMBER_BORDER = rgb(0.706, 0.325, 0.035); // #B45309
const COLOR_AMBER_BG = rgb(1.0, 0.984, 0.922);        // #FFFBEB
const COLOR_AMBER_PILL_BG = rgb(0.992, 0.902, 0.541); // #FDE68A
const COLOR_AMBER_PILL_TEXT = rgb(0.471, 0.208, 0.059); // #78350F

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
  opts: {
    x?: number;
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const color = opts.color ?? COLOR_TEXT;
  ctx.page.drawText(text, {
    x: opts.x ?? MARGIN_X,
    y: ctx.y,
    size,
    font,
    color,
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

/** Greedy text wrap by word at a target pixel width. */
function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      const w = font.widthOfTextAtSize(candidate, size);
      if (w > maxWidth && current.length > 0) {
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

  // Right-aligned date
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
  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y: 30,
    size: 8,
    font,
    color: COLOR_SUBTLE,
  });
}

function drawTitle(ctx: Ctx, patientName: string): void {
  drawText(ctx, 'briefSLANSS', { bold: true, size: 18, color: COLOR_TEXT });
  moveDown(ctx, 22);
  drawText(ctx, 'Brief neuropathic symptoms and signs — results report', {
    size: 11,
    color: COLOR_MUTED,
  });
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

/**
 * Score card — mirrors the on-screen treatment from briefSLANSSResults.svelte:
 * a tinted box with a colored left border, a large numeric score, and a
 * verdict pill. Purple/normal vs amber/elevated based on threshold.
 */
function drawScoreCard(ctx: Ctx, result: briefSLANSSResult): void {
  drawSectionHeading(ctx, 'Score');

  const elevated = result.total_score >= NEUROPATHIC_THRESHOLD;
  const borderColor = elevated ? COLOR_AMBER_BORDER : COLOR_PRIMARY;
  const bgColor = elevated ? COLOR_AMBER_BG : COLOR_TINT;
  const pillBg = elevated ? COLOR_AMBER_PILL_BG : COLOR_TINT;
  const pillText = elevated ? COLOR_AMBER_PILL_TEXT : COLOR_PRIMARY;

  const cardH = 90;
  ensureSpace(ctx, cardH + 12);

  // Card background + left accent border
  const cardTop = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: cardTop - cardH,
    width: CONTENT_W,
    height: cardH,
    color: bgColor,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: cardTop - cardH,
    width: 4,
    height: cardH,
    color: borderColor,
  });

  // Score number (left)
  const scoreText = String(result.total_score);
  const scoreSize = 36;
  const scoreX = MARGIN_X + 24;
  const scoreY = cardTop - 56;
  ctx.page.drawText(scoreText, {
    x: scoreX,
    y: scoreY,
    size: scoreSize,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });

  // Verdict pill (right side of card)
  const pillPaddingX = 12;
  const pillPaddingY = 6;
  const pillSize = 11;
  const pillTextW = ctx.fontBold.widthOfTextAtSize(result.interpretation, pillSize);
  const pillW = pillTextW + pillPaddingX * 2;
  const pillH = pillSize + pillPaddingY * 2;
  const pillX = MARGIN_X + CONTENT_W - pillW - 16;
  const pillY = cardTop - cardH / 2 - pillH / 2;

  ctx.page.drawRectangle({
    x: pillX,
    y: pillY,
    width: pillW,
    height: pillH,
    color: pillBg,
    borderColor: borderColor,
    borderWidth: 0.5,
  });
  ctx.page.drawText(result.interpretation, {
    x: pillX + pillPaddingX,
    y: pillY + pillPaddingY + 2,
    size: pillSize,
    font: ctx.fontBold,
    color: pillText,
  });

  moveDown(ctx, cardH + 16);
}

function drawInterpretationNote(ctx: Ctx): void {
  const note =
    `Scores at or above ${NEUROPATHIC_THRESHOLD} suggest a predominantly neuropathic pain ` +
    `mechanism. This is a screening result, not a diagnosis.`;
  const lines = wrapText(note, CONTENT_W, ctx.font, 9);
  ensureSpace(ctx, lines.length * 13 + 8);
  for (const line of lines) {
    drawText(ctx, line, { size: 9, color: COLOR_MUTED });
    moveDown(ctx, 13);
  }
  moveDown(ctx, 12);
}

function drawComments(ctx: Ctx, comments: string): void {
  drawSectionHeading(ctx, 'Other comments');
  const lines = wrapText(comments, CONTENT_W - 16, ctx.font, 10);
  const blockHeight = lines.length * 14 + 16;
  ensureSpace(ctx, blockHeight);

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - blockHeight + 14,
    width: CONTENT_W,
    height: blockHeight,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  moveDown(ctx, 4);
  for (const line of lines) {
    drawText(ctx, line, { x: MARGIN_X + 8, size: 10 });
    moveDown(ctx, 14);
  }
  moveDown(ctx, 8);
}
