/**
 * Shared toolkit for PATH's text-based PDF reports.
 *
 * Every assessment report is a clean, selectable/searchable PDF built with
 * pdf-lib. They all share the same page geometry, palette, header/footer,
 * title block, and a `y`-cursor layout model (origin at bottom-left, content
 * laid out top-to-bottom). This module owns those shared pieces so each
 * per-assessment generator only supplies what actually differs: its metadata,
 * title text, and the sections unique to that assessment.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------

export const PAGE_W = 612; // US Letter
export const PAGE_H = 792;
export const MARGIN_TOP = 50;
export const MARGIN_BOTTOM = 60;
export const MARGIN_X = 50;
export const CONTENT_W = PAGE_W - 2 * MARGIN_X;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const COLOR_PRIMARY = rgb(0.31, 0.149, 0.514); // #4F2683
export const COLOR_PRIMARY_TINT = rgb(0.722, 0.624, 0.82); // #B89FD1
export const COLOR_TEXT = rgb(0.122, 0.122, 0.122); // #1F1F1F
export const COLOR_MUTED = rgb(0.361, 0.361, 0.361); // #5C5C5C
export const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533); // #888
export const COLOR_BORDER = rgb(0.898, 0.898, 0.898); // #E5E5E5
export const COLOR_TINT = rgb(0.961, 0.941, 0.98); // #F5F0FA
export const COLOR_WHITE = rgb(1, 1, 1);

export const COLOR_AMBER_BORDER = rgb(0.706, 0.325, 0.035); // #B45309
export const COLOR_AMBER_BG = rgb(1.0, 0.984, 0.922); // #FFFBEB
export const COLOR_AMBER_PILL_BG = rgb(0.992, 0.902, 0.541); // #FDE68A
export const COLOR_AMBER_PILL_TEXT = rgb(0.471, 0.208, 0.059); // #78350F

export const COLOR_SUCCESS = rgb(0.18, 0.49, 0.357); // #2E7D5B
export const COLOR_DANGER = rgb(0.706, 0.227, 0.227); // #B43A3A
export const COLOR_WARNING = rgb(0.722, 0.525, 0.043); // #B8860B

/** A pdf-lib color value. */
export type Rgb = ReturnType<typeof rgb>;

// ---------------------------------------------------------------------------
// Layout context
// ---------------------------------------------------------------------------

export interface Ctx {
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

/** Break to a new page (with a compact header) if `needed` points won't fit. */
export function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.pageNum += 1;
    ctx.y = PAGE_H - MARGIN_TOP;
    drawHeader(ctx, { compact: true });
  }
}

export function moveDown(ctx: Ctx, dy: number): void {
  ctx.y -= dy;
}

export function drawText(
  ctx: Ctx,
  text: string,
  opts: { x?: number; size?: number; bold?: boolean; color?: Rgb } = {},
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

/** Right-align `text` against the content's right edge at the current `y`. */
export function drawRightText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: Rgb } = {},
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

export function drawRule(ctx: Ctx, color: Rgb = COLOR_BORDER, thickness = 0.5): void {
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: MARGIN_X + CONTENT_W, y: ctx.y },
    thickness,
    color,
  });
}

/** Greedy text wrap by word at a target pixel width. */
export function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
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
// Shared sections
// ---------------------------------------------------------------------------

export function drawHeader(ctx: Ctx, opts: { compact?: boolean } = {}): void {
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

export function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number): void {
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

/** Report title block: large title, muted subtitle, optional patient name. */
export function drawTitle(
  ctx: Ctx,
  opts: { title: string; subtitle: string; patientName: string },
): void {
  drawText(ctx, opts.title, { bold: true, size: 18, color: COLOR_TEXT });
  moveDown(ctx, 22);
  drawText(ctx, opts.subtitle, { size: 11, color: COLOR_MUTED });
  moveDown(ctx, 22);

  if (opts.patientName) {
    drawText(ctx, 'Patient', { size: 8, color: COLOR_MUTED, bold: true });
    moveDown(ctx, 14);
    drawText(ctx, opts.patientName, { bold: true, size: 14, color: COLOR_PRIMARY });
    moveDown(ctx, 24);
  }
}

export function drawSectionHeading(ctx: Ctx, title: string): void {
  ensureSpace(ctx, 40);
  drawText(ctx, title, { bold: true, size: 13, color: COLOR_TEXT });
  moveDown(ctx, 8);
  drawRule(ctx, COLOR_PRIMARY, 1);
  moveDown(ctx, 16);
}

/**
 * Score card — a tinted box with a colored left accent, a large numeric score,
 * and a verdict pill. Purple/normal vs amber/elevated based on `elevated`.
 * Shared by the single-score screening reports.
 */
export function drawScoreCard(
  ctx: Ctx,
  opts: { score: number; interpretation: string; elevated: boolean },
): void {
  drawSectionHeading(ctx, 'Score');

  const { elevated, interpretation } = opts;
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
  ctx.page.drawText(String(opts.score), {
    x: MARGIN_X + 24,
    y: cardTop - 56,
    size: 36,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });

  // Verdict pill (right side of card)
  const pillPaddingX = 12;
  const pillPaddingY = 6;
  const pillSize = 11;
  const pillTextW = ctx.fontBold.widthOfTextAtSize(interpretation, pillSize);
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
    borderColor,
    borderWidth: 0.5,
  });
  ctx.page.drawText(interpretation, {
    x: pillX + pillPaddingX,
    y: pillY + pillPaddingY + 2,
    size: pillSize,
    font: ctx.fontBold,
    color: pillText,
  });

  moveDown(ctx, cardH + 16);
}

/** Muted wrapped-paragraph note. `rule` draws a divider above it. */
export function drawNote(
  ctx: Ctx,
  text: string,
  opts: { rule?: boolean; trailing?: number } = {},
): void {
  const lines = wrapText(text, CONTENT_W, ctx.font, 9);
  ensureSpace(ctx, lines.length * 13 + 8);
  if (opts.rule) {
    drawRule(ctx);
    moveDown(ctx, 14);
  }
  for (const line of lines) {
    drawText(ctx, line, { size: 9, color: COLOR_MUTED });
    moveDown(ctx, 13);
  }
  if (opts.trailing) moveDown(ctx, opts.trailing);
}

/** "Other comments" section: a bordered box of wrapped comment text. */
export function drawComments(ctx: Ctx, comments: string): void {
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

// ---------------------------------------------------------------------------
// Document lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a report document with standard metadata, embedded Helvetica fonts,
 * a first page, and the full header already drawn. The caller continues
 * laying out from `ctx` and finishes with {@link finalizeReport}.
 */
export async function createReport(meta: { title: string; subject: string }): Promise<Ctx> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setSubject(meta.subject);
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
  return ctx;
}

/** Stamp every page's footer (now that the total is known) and serialize. */
export function finalizeReport(ctx: Ctx): Promise<Uint8Array> {
  const total = ctx.doc.getPageCount();
  for (let i = 0; i < total; i += 1) {
    drawFooter(ctx.doc.getPage(i), ctx.font, i + 1, total);
  }
  return ctx.doc.save();
}

/** Filename suggestion — `<prefix>[_<name>]_<date>.pdf`, sanitized. */
export function buildFilename(prefix: string, patientName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const safe = patientName
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return safe ? `${prefix}_${safe}_${today}.pdf` : `${prefix}_${today}.pdf`;
}
