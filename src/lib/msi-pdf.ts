/**
 * MSI PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains
 * selectable and searchable in the output; charts are embedded as
 * PNG rasterizations of the existing Chart.js canvases.
 *
 * Page layout uses pdf-lib's native coordinate system (origin at
 * bottom-left). Content is laid out top-to-bottom by tracking a
 * `y` cursor and advancing downward as elements are drawn.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { MSIResult } from '../assessments/msi/scoring';
import type { MSIRole } from '../assessments/msi/questions';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PDFInput {
  result: MSIResult;
  role: MSIRole;
  patientName: string;
  chartImages: {
    somaticBar: string; // data URL
    radar: string; // data URL
  };
}

export async function generateMSIReport(input: PDFInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('MSI Results');
  doc.setSubject('Multi-Dimensional Symptom Index — clinical results');
  doc.setProducer('PATH — Pain Assessment Tools Hub');
  doc.setCreator('PATH');
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const barImg = await embedPng(doc, input.chartImages.somaticBar);
  const radarImg = await embedPng(doc, input.chartImages.radar);

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
  drawSummaryScores(ctx, input.result);
  if (input.role === 'professional') {
    drawScreening(ctx, input.result);
  }
  drawComments(ctx, input.result.comments);
  drawCharts(ctx, barImg, radarImg);

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
  return safe ? `MSI_Results_${safe}_${today}.pdf` : `MSI_Results_${today}.pdf`;
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
const COLOR_TEXT = rgb(0.122, 0.122, 0.122);   // #1F1F1F
const COLOR_MUTED = rgb(0.361, 0.361, 0.361);  // #5C5C5C
const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533); // #888
const COLOR_BORDER = rgb(0.898, 0.898, 0.898); // #E5E5E5
const COLOR_TINT = rgb(0.961, 0.941, 0.980);   // #F5F0FA

const COLOR_SUCCESS = rgb(0.18, 0.49, 0.357);  // #2E7D5B
const COLOR_DANGER = rgb(0.706, 0.227, 0.227); // #B43A3A
const COLOR_WARNING = rgb(0.722, 0.525, 0.043); // #B8860B

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
// PNG embedding
// ---------------------------------------------------------------------------

async function embedPng(doc: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  return doc.embedPng(bytes);
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
  drawText(ctx, 'Multi-Dimensional Symptom Index', { bold: true, size: 18, color: COLOR_TEXT });
  moveDown(ctx, 22);
  drawText(ctx, 'Results report', { size: 11, color: COLOR_MUTED });
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

function drawSummaryScores(ctx: Ctx, result: MSIResult): void {
  drawSectionHeading(ctx, 'Summary scores');

  const TARGETS = { symp_no: 1.8, freq_mean: 0.9, int_mean: 1.0, somatic: 7.5, nonsomatic: 6.1 };
  const target = (current: number, threshold: number) => Math.max(0, current - threshold);
  const fmtInt = (n: number) => Math.round(n).toString();
  const fmt1 = (n: number) => n.toFixed(1);
  const pct = (v: number, max: number) => `${Math.round((v / max) * 100)}%`;

  const rows: [string, string, string][] = [
    [
      'Number of symptoms',
      `${result.symp_no} (${pct(result.symp_no, 10)})`,
      fmtInt(target(result.symp_no, TARGETS.symp_no)),
    ],
    [
      'Mean frequency',
      `${fmt1(result.freq_mean)} (${pct(result.freq_mean, 3)})`,
      fmt1(target(result.freq_mean, TARGETS.freq_mean)),
    ],
    [
      'Mean bothersomeness',
      `${fmt1(result.int_mean)} (${pct(result.int_mean, 4)})`,
      fmt1(target(result.int_mean, TARGETS.int_mean)),
    ],
    [
      'Somatic symptoms',
      `${fmtInt(result.somatic)} (${pct(result.somatic, 60)})`,
      fmtInt(target(result.somatic, TARGETS.somatic)),
    ],
    [
      'Non-somatic symptoms',
      `${fmtInt(result.nonsomatic)} (${pct(result.nonsomatic, 72)})`,
      fmtInt(target(result.nonsomatic, TARGETS.nonsomatic)),
    ],
  ];

  // Column layout: 240 / 130 / 130
  const colX = { label: MARGIN_X, current: MARGIN_X + 240, target: MARGIN_X + 240 + 130 };
  const rowHeight = 22;

  // Header background
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 8,
    width: CONTENT_W,
    height: 22,
    color: COLOR_TINT,
  });
  drawText(ctx, 'MEASURE', { x: colX.label + 8, size: 8, bold: true, color: COLOR_PRIMARY });
  drawText(ctx, 'CURRENT', { x: colX.current + 8, size: 8, bold: true, color: COLOR_PRIMARY });
  drawText(ctx, 'TARGET FOR MEANINGFUL CHANGE', {
    x: colX.target + 8,
    size: 8,
    bold: true,
    color: COLOR_PRIMARY,
  });
  moveDown(ctx, 22);

  for (const [label, current, targetVal] of rows) {
    ensureSpace(ctx, rowHeight + 2);
    drawText(ctx, label, { x: colX.label + 8, size: 10 });
    drawText(ctx, current, { x: colX.current + 8, size: 10, bold: true });
    drawText(ctx, targetVal, { x: colX.target + 8, size: 10, bold: true });
    moveDown(ctx, 6);
    drawRule(ctx);
    moveDown(ctx, rowHeight - 6);
  }
  moveDown(ctx, 12);
}

function drawScreening(ctx: Ctx, result: MSIResult): void {
  drawSectionHeading(ctx, 'Screening results');
  drawText(ctx, 'Predictive flags based on non-somatic symptom total. Indicators, not diagnoses.', {
    size: 9,
    color: COLOR_MUTED,
  });
  moveDown(ctx, 18);

  const rows: [string, 'Likely' | 'Unlikely' | 'Unclear', boolean][] = [
    ['Full recovery predicted', result.full_rec, /* positive=good */ true],
    ['Potential Major Depressive Disorder', result.mdd, /* positive=good */ false],
  ];

  for (const [label, verdict, goodIsLikely] of rows) {
    ensureSpace(ctx, 24);
    drawText(ctx, label, { size: 10 });

    const verdictColor =
      verdict === 'Unclear'
        ? COLOR_WARNING
        : (verdict === 'Likely') === goodIsLikely
          ? COLOR_SUCCESS
          : COLOR_DANGER;
    const verdictWidth = ctx.fontBold.widthOfTextAtSize(verdict, 11);
    ctx.page.drawText(verdict, {
      x: MARGIN_X + CONTENT_W - verdictWidth,
      y: ctx.y,
      size: 11,
      font: ctx.fontBold,
      color: verdictColor,
    });
    moveDown(ctx, 8);
    drawRule(ctx);
    moveDown(ctx, 14);
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

function drawCharts(ctx: Ctx, barImg: PDFImage, radarImg: PDFImage): void {
  // Charts together need ~ 480pt of vertical space. Force a new page
  // if we don't have room (rather than half-chart at bottom of page).
  if (ctx.y - 480 < MARGIN_BOTTOM) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.pageNum += 1;
    ctx.y = PAGE_H - MARGIN_TOP;
    drawHeader(ctx, { compact: true });
  }

  drawSectionHeading(ctx, 'Charts');

  // Somatic vs non-somatic bar — embed at content width, scaled.
  const barTargetW = CONTENT_W;
  const barAspect = barImg.height / barImg.width;
  const barTargetH = Math.min(barTargetW * barAspect, 160);
  moveDown(ctx, 0);
  ctx.page.drawImage(barImg, {
    x: MARGIN_X,
    y: ctx.y - barTargetH,
    width: barTargetW,
    height: barTargetH,
  });
  moveDown(ctx, barTargetH + 8);
  drawText(ctx, 'Somatic vs Non-somatic symptoms — percent of maximum', {
    size: 9,
    color: COLOR_MUTED,
  });
  moveDown(ctx, 24);

  // Radar — square, centered on the page.
  const radarTargetH = 300;
  const radarTargetW = radarTargetH; // 1:1
  const radarX = MARGIN_X + (CONTENT_W - radarTargetW) / 2;
  ensureSpace(ctx, radarTargetH + 20);
  ctx.page.drawImage(radarImg, {
    x: radarX,
    y: ctx.y - radarTargetH,
    width: radarTargetW,
    height: radarTargetH,
  });
  moveDown(ctx, radarTargetH + 8);
  drawText(ctx, 'Per-symptom values (0-12 scale)', {
    size: 9,
    color: COLOR_MUTED,
    x: radarX,
  });
  moveDown(ctx, 16);
}
