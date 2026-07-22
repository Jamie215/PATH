/**
 * OMR answer-sheet generator.
 *
 * Renders a blank, printable PDF answer sheet from an `OmrTemplate` using
 * pdf-lib. The template owns the bubble geometry (in normalized page
 * coordinates, top-left origin); this renderer converts to pdf-lib's
 * bottom-left point system and places all decorative text — headers,
 * legends, row labels, column headers — relative to those bubbles, so the
 * bubbles stay the single shared truth between the printed sheet and the
 * reader.
 *
 * The output is intentionally plain: crisp black marks on white, generous
 * quiet margins, and four solid corner fiducials, all chosen to survive a
 * phone photo and re-register cleanly during reading.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { OmrTemplate, OmrSection } from '../assessments/omr/types';

const COLOR_INK = rgb(0, 0, 0);
const COLOR_PRIMARY = rgb(0.31, 0.149, 0.514); // #4F2683
const COLOR_MUTED = rgb(0.361, 0.361, 0.361);
const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533);

const MARGIN_X = 50;

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  pageW: number;
  pageH: number;
}

/** Normalized top-left x → point x. */
const toX = (ctx: Ctx, xNorm: number): number => xNorm * ctx.pageW;
/** Normalized top-left y → point y (flip to pdf-lib's bottom-left origin). */
const toY = (ctx: Ctx, yNorm: number): number => ctx.pageH - yNorm * ctx.pageH;

/** Draw text centered horizontally on a point x. */
function drawCentered(
  ctx: Ctx,
  text: string,
  centerXpt: number,
  yPt: number,
  size: number,
  font: PDFFont,
  color = COLOR_INK,
): void {
  const w = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x: centerXpt - w / 2, y: yPt, size, font, color });
}

export async function generateAnswerSheet(template: OmrTemplate): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${template.title} — Answer Sheet`);
  doc.setSubject('OMR answer sheet');
  doc.setProducer('PATH — Pain Assessment Tools Hub');
  doc.setCreator('PATH');
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([template.page.width, template.page.height]);

  const ctx: Ctx = {
    page,
    font,
    fontBold,
    pageW: template.page.width,
    pageH: template.page.height,
  };

  drawFiducials(ctx, template);
  drawHeader(ctx, template);
  for (const section of template.sections) drawSection(ctx, section, template);
  drawFooter(ctx, template);

  return doc.save();
}

/** Suggested download filename for a blank sheet. */
export function buildAnswerSheetFilename(template: OmrTemplate): string {
  return `${template.id}_answer_sheet.pdf`;
}

// ---------------------------------------------------------------------------

function drawFiducials(ctx: Ctx, template: OmrTemplate): void {
  const side = template.fiducialSize * ctx.pageW;
  for (const f of template.fiducials) {
    // drawRectangle's (x, y) is the bottom-left corner; center the square.
    const cx = toX(ctx, f.x);
    const cy = toY(ctx, f.y);
    ctx.page.drawRectangle({
      x: cx - side / 2,
      y: cy - side / 2,
      width: side,
      height: side,
      color: COLOR_INK,
    });
  }
}

function drawHeader(ctx: Ctx, template: OmrTemplate): void {
  // Brand + form id row.
  ctx.page.drawText('PATH', {
    x: MARGIN_X,
    y: ctx.pageH - 46,
    size: 13,
    font: ctx.fontBold,
    color: COLOR_PRIMARY,
  });
  const idText = `Form ${template.id}`;
  const idW = ctx.font.widthOfTextAtSize(idText, 9);
  ctx.page.drawText(idText, {
    x: ctx.pageW - MARGIN_X - idW,
    y: ctx.pageH - 46,
    size: 9,
    font: ctx.font,
    color: COLOR_SUBTLE,
  });

  // Title + subtitle.
  ctx.page.drawText(template.title, {
    x: MARGIN_X,
    y: ctx.pageH - 70,
    size: 16,
    font: ctx.fontBold,
    color: COLOR_INK,
  });
  ctx.page.drawText(template.subtitle, {
    x: MARGIN_X,
    y: ctx.pageH - 86,
    size: 10,
    font: ctx.font,
    color: COLOR_MUTED,
  });

  // Instructions.
  let y = ctx.pageH - 104;
  for (const line of template.instructions) {
    ctx.page.drawText(`•  ${line}`, {
      x: MARGIN_X,
      y,
      size: 8.5,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    y -= 12;
  }

  // Freeform patient / date line (not machine-read).
  y -= 6;
  ctx.page.drawText('Name / ID: ______________________________', {
    x: MARGIN_X,
    y,
    size: 9,
    font: ctx.font,
    color: COLOR_INK,
  });
  ctx.page.drawText('Date: ________________', {
    x: ctx.pageW - MARGIN_X - 150,
    y,
    size: 9,
    font: ctx.font,
    color: COLOR_INK,
  });
}

function drawSection(ctx: Ctx, section: OmrSection, template: OmrTemplate): void {
  // Topmost bubble Y across the section — everything decorative sits above it.
  const firstRowYnorm = Math.min(
    ...section.rows.flatMap((r) => r.fields.flatMap((f) => f.bubbles.map((b) => b.center.y))),
  );
  const firstRowYpt = toY(ctx, firstRowYnorm);

  // Section title.
  ctx.page.drawText(section.title, {
    x: MARGIN_X,
    y: firstRowYpt + 64,
    size: 12,
    font: ctx.fontBold,
    color: COLOR_INK,
  });

  // Legend lines.
  let ly = firstRowYpt + 50;
  for (const line of section.legend) {
    ctx.page.drawText(line, { x: MARGIN_X, y: ly, size: 8, font: ctx.font, color: COLOR_MUTED });
    ly -= 11;
  }

  // Column-group labels + per-column option headers, just above the grid.
  for (const group of section.columnGroups) {
    const centerX =
      (toX(ctx, group.columnX[0]) + toX(ctx, group.columnX[group.columnX.length - 1])) / 2;
    drawCentered(ctx, group.label, centerX, firstRowYpt + 22, 7.5, ctx.fontBold, COLOR_PRIMARY);
    group.optionHeaders.forEach((h, i) => {
      drawCentered(ctx, h, toX(ctx, group.columnX[i]), firstRowYpt + 10, 8, ctx.font, COLOR_MUTED);
    });
  }

  // Rows: label on the left, bubble circles across.
  const radiusPt = template.bubbleRadius * ctx.pageW;
  for (const row of section.rows) {
    const rowYnorm = row.fields[0].bubbles[0].center.y;
    const yPt = toY(ctx, rowYnorm);
    ctx.page.drawText(row.label, {
      x: MARGIN_X,
      y: yPt - 3, // nudge to visually center against the bubbles
      size: 9.5,
      font: ctx.font,
      color: COLOR_INK,
    });
    for (const field of row.fields) {
      for (const bubble of field.bubbles) {
        ctx.page.drawCircle({
          x: toX(ctx, bubble.center.x),
          y: toY(ctx, bubble.center.y),
          size: radiusPt,
          borderColor: COLOR_INK,
          borderWidth: 1,
        });
      }
    }
  }
}

function drawFooter(ctx: Ctx, template: OmrTemplate): void {
  const text = `${template.title} · Form ${template.id} · Generated by PATH — fill by hand, then scan`;
  const w = ctx.font.widthOfTextAtSize(text, 7.5);
  ctx.page.drawText(text, {
    x: (ctx.pageW - w) / 2,
    y: 28,
    size: 7.5,
    font: ctx.font,
    color: COLOR_SUBTLE,
  });
}
