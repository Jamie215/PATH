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
const COLOR_TEXT = rgb(0.12, 0.12, 0.12);
const COLOR_PRIMARY = rgb(0.31, 0.149, 0.514); // #4F2683
const COLOR_MUTED = rgb(0.361, 0.361, 0.361);
const COLOR_SUBTLE = rgb(0.533, 0.533, 0.533);
const COLOR_HAIRLINE = rgb(0.88, 0.88, 0.88); // eye-tracking separators
const COLOR_TINT = rgb(0.961, 0.941, 0.98); // #F5F0FA callout background
const COLOR_TINT_BORDER = rgb(0.82, 0.76, 0.9); // callout border

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

function drawSquare(ctx: Ctx, center: { x: number; y: number }, sideNorm: number): void {
  // drawRectangle's (x, y) is the bottom-left corner; center the square.
  const side = sideNorm * ctx.pageW;
  ctx.page.drawRectangle({
    x: toX(ctx, center.x) - side / 2,
    y: toY(ctx, center.y) - side / 2,
    width: side,
    height: side,
    color: COLOR_INK,
  });
}

function drawFiducials(ctx: Ctx, template: OmrTemplate): void {
  for (const f of template.fiducials) drawSquare(ctx, f, template.fiducialSize);
  // Orientation key: a smaller solid square inset from the top-left corner,
  // so the reader can tell an upright scan from a rotated/flipped one.
  drawSquare(ctx, template.orientationMark.center, template.orientationMark.size);
}

function drawHeader(ctx: Ctx, template: OmrTemplate): void {
  const contentW = ctx.pageW - 2 * MARGIN_X;
  // Work in top-left coordinates; flip once per baseline.
  const at = (topY: number): number => ctx.pageH - topY;

  // Brand + form id row.
  ctx.page.drawText('PATH', {
    x: MARGIN_X,
    y: at(48),
    size: 13,
    font: ctx.fontBold,
    color: COLOR_PRIMARY,
  });
  const idText = `Form ${template.id}`;
  const idW = ctx.font.widthOfTextAtSize(idText, 9);
  ctx.page.drawText(idText, {
    x: ctx.pageW - MARGIN_X - idW,
    y: at(48),
    size: 9,
    font: ctx.font,
    color: COLOR_SUBTLE,
  });

  // Title + subtitle.
  ctx.page.drawText(template.title, {
    x: MARGIN_X,
    y: at(78),
    size: 17,
    font: ctx.fontBold,
    color: COLOR_INK,
  });
  ctx.page.drawText(template.subtitle, {
    x: MARGIN_X,
    y: at(98),
    size: 10.5,
    font: ctx.font,
    color: COLOR_MUTED,
  });

  // Instructions callout — a tinted, bordered panel so the fill-out rules
  // read as important, not fine print. Sits above the bubble grid, so the
  // background never touches a mark the reader has to sample.
  const boxTop = 116;
  const lineGap = 16;
  const boxHeight = 34 + template.instructions.length * lineGap;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: at(boxTop + boxHeight),
    width: contentW,
    height: boxHeight,
    color: COLOR_TINT,
    borderColor: COLOR_TINT_BORDER,
    borderWidth: 1,
  });
  ctx.page.drawText('INSTRUCTIONS', {
    x: MARGIN_X + 14,
    y: at(boxTop + 20),
    size: 9.5,
    font: ctx.fontBold,
    color: COLOR_PRIMARY,
  });
  template.instructions.forEach((line, i) => {
    const y = at(boxTop + 38 + i * lineGap);
    ctx.page.drawText('•', { x: MARGIN_X + 14, y, size: 10, font: ctx.fontBold, color: COLOR_PRIMARY });
    ctx.page.drawText(line, { x: MARGIN_X + 26, y, size: 9.5, font: ctx.font, color: COLOR_TEXT });
  });

  // Freeform patient / date line (not machine-read).
  const nameY = at(boxTop + boxHeight + 30);
  ctx.page.drawText('Name / ID: ______________________________', {
    x: MARGIN_X,
    y: nameY,
    size: 9.5,
    font: ctx.font,
    color: COLOR_INK,
  });
  ctx.page.drawText('Date: ________________', {
    x: ctx.pageW - MARGIN_X - 150,
    y: nameY,
    size: 9.5,
    font: ctx.font,
    color: COLOR_INK,
  });
}

const LABEL_X = MARGIN_X + 18; // leaves room for the row number
const RADIUS_TO_CONTENT = 6; // bubble radius fallback for extents

function drawSection(ctx: Ctx, section: OmrSection, template: OmrTemplate): void {
  const radiusPt = template.bubbleRadius * ctx.pageW || RADIUS_TO_CONTENT;

  // Vertical extent of the bubble grid.
  const allY = section.rows.flatMap((r) => r.fields.flatMap((f) => f.bubbles.map((b) => b.center.y)));
  const firstRowYpt = toY(ctx, Math.min(...allY));
  const lastRowYpt = toY(ctx, Math.max(...allY));

  // Horizontal extent of the bubble grid (for separators / divider).
  const allX = section.columnGroups.flatMap((g) => g.columnX);
  const gridLeftPt = toX(ctx, Math.min(...allX)) - radiusPt;
  const gridRightPt = toX(ctx, Math.max(...allX)) + radiusPt;

  // Section title.
  ctx.page.drawText(section.title, {
    x: MARGIN_X,
    y: firstRowYpt + 66,
    size: 13,
    font: ctx.fontBold,
    color: COLOR_INK,
  });

  // Legend lines (usually empty now that words label the columns directly).
  let ly = firstRowYpt + 50;
  for (const line of section.legend) {
    ctx.page.drawText(line, { x: MARGIN_X, y: ly, size: 8.5, font: ctx.font, color: COLOR_MUTED });
    ly -= 12;
  }

  // Group question headers + per-column word labels, just above the grid.
  for (const group of section.columnGroups) {
    const centerX =
      (toX(ctx, group.columnX[0]) + toX(ctx, group.columnX[group.columnX.length - 1])) / 2;
    drawCentered(ctx, group.label, centerX, firstRowYpt + 38, 10, ctx.fontBold, COLOR_PRIMARY);
    group.optionHeaders.forEach((h, i) => {
      drawCentered(ctx, h, toX(ctx, group.columnX[i]), firstRowYpt + 18, 8, ctx.font, COLOR_MUTED);
    });
  }

  // Light divider between the two column groups, plus a rule under the headers.
  if (section.columnGroups.length === 2) {
    const gap =
      (toX(ctx, section.columnGroups[0].columnX.at(-1)!) +
        toX(ctx, section.columnGroups[1].columnX[0])) /
      2;
    ctx.page.drawLine({
      start: { x: gap, y: firstRowYpt + 24 },
      end: { x: gap, y: lastRowYpt - radiusPt - 4 },
      thickness: 0.5,
      color: COLOR_HAIRLINE,
    });
  }
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: firstRowYpt + 10 },
    end: { x: gridRightPt, y: firstRowYpt + 10 },
    thickness: 0.5,
    color: COLOR_HAIRLINE,
  });

  // Rows: number, label (+ optional description), bubbles, hairline separator.
  section.rows.forEach((row, i) => {
    const yPt = toY(ctx, row.fields[0].bubbles[0].center.y);

    ctx.page.drawText(`${i + 1}`, {
      x: MARGIN_X,
      y: yPt - 4,
      size: 10.5,
      font: ctx.fontBold,
      color: COLOR_SUBTLE,
    });
    ctx.page.drawText(row.label, {
      x: LABEL_X,
      y: row.description ? yPt + 2 : yPt - 4,
      size: 11,
      font: ctx.font,
      color: COLOR_INK,
    });
    if (row.description) {
      ctx.page.drawText(row.description, {
        x: LABEL_X,
        y: yPt - 11,
        size: 8,
        font: ctx.font,
        color: COLOR_MUTED,
      });
    }

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

    // Separator below every row but the last.
    if (i < section.rows.length - 1) {
      const nextYpt = toY(ctx, section.rows[i + 1].fields[0].bubbles[0].center.y);
      ctx.page.drawLine({
        start: { x: MARGIN_X, y: (yPt + nextYpt) / 2 },
        end: { x: gridRightPt, y: (yPt + nextYpt) / 2 },
        thickness: 0.4,
        color: COLOR_HAIRLINE,
      });
    }
  });
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
