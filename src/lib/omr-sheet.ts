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
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFForm } from 'pdf-lib';
import type { OmrTemplate, OmrSection, OmrColumnGroup } from '../assessments/omr/types';

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
  doc: PDFDocument;
  page: PDFPage;
  form: PDFForm;
  font: PDFFont;
  fontBold: PDFFont;
  pageW: number;
  pageH: number;
  /** Namespaces every form-field name, so several sheets can share one
   *  interactive form in a combined document without field-name collisions
   *  (e.g. each sheet's `other_comments`/`patient_name`). Empty for a lone sheet. */
  fieldPrefix: string;
}

/** Normalized top-left x → point x. */
const toX = (ctx: Ctx, xNorm: number): number => xNorm * ctx.pageW;
/** Normalized top-left y → point y (flip to pdf-lib's bottom-left origin). */
const toY = (ctx: Ctx, yNorm: number): number => ctx.pageH - yNorm * ctx.pageH;

/** Greedy word-wrap `text` to fit `maxWidth` at the given font/size. */
function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

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

/**
 * Draw a small example bubble at a point baseline, illustrating how a mark
 * should look. `kind` picks the correctly-filled disc, an empty bubble, or a
 * crossed-out (changed-answer) bubble. Returns nothing — purely decorative.
 */
function drawBubbleGlyph(
  ctx: Ctx,
  cxPt: number,
  cyPt: number,
  kind: 'filled' | 'empty' | 'crossed',
  radiusPt = 5,
): void {
  ctx.page.drawCircle({ x: cxPt, y: cyPt, size: radiusPt, borderColor: COLOR_INK, borderWidth: 1 });
  if (kind === 'filled') {
    // A firm, complete mark: a solid disc that nearly fills the ring.
    ctx.page.drawCircle({ x: cxPt, y: cyPt, size: radiusPt - 1.4, color: COLOR_INK });
  } else if (kind === 'crossed') {
    // A cancelled bubble: an X drawn across it, matching the "cross out" rule.
    const d = radiusPt + 1.5;
    ctx.page.drawLine({ start: { x: cxPt - d, y: cyPt - d }, end: { x: cxPt + d, y: cyPt + d }, thickness: 1, color: COLOR_INK });
    ctx.page.drawLine({ start: { x: cxPt - d, y: cyPt + d }, end: { x: cxPt + d, y: cyPt - d }, thickness: 1, color: COLOR_INK });
  }
}

/** A single blank, printable/fillable answer sheet for one assessment. */
export async function generateAnswerSheet(template: OmrTemplate): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${template.title} — Answer Sheet`);
  doc.setSubject('OMR answer sheet');
  // Machine-readable form identity. The upload reader parses the `form:<id>`
  // token back out (see pdf-form-reader) and refuses a sheet whose id doesn't
  // match the assessment being entered, so one form can't be read against
  // another's template.
  doc.setKeywords(['omr-answer-sheet', `form:${template.id}`]);
  doc.setProducer('PATH — Pain Assessment Tools Hub');
  doc.setCreator('PATH');
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  renderSheet(doc, font, fontBold, form, template, {});

  return doc.save();
}

/**
 * Render one template's page(s) and interactive fields into an existing
 * document, sharing its form and fonts. `fieldPrefix` namespaces every field so
 * multiple sheets can coexist in one document's form; a lone sheet uses none.
 * Pre-fills answers when given. Kept separate from `generateAnswerSheet` so the
 * combined generator can lay several sheets into a single fillable form.
 */
function renderSheet(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  form: PDFForm,
  template: OmrTemplate,
  options: { answers?: Record<string, number | string>; fieldPrefix?: string },
): void {
  const ctx: Ctx = {
    doc,
    page: doc.addPage([template.page.width, template.page.height]),
    form,
    font,
    fontBold,
    pageW: template.page.width,
    pageH: template.page.height,
    fieldPrefix: options.fieldPrefix ?? '',
  };

  drawFiducials(ctx, template);
  drawHeader(ctx, template);
  for (const section of template.sections) drawSection(ctx, section, template);
  drawFooter(ctx, template);
  drawCommentBox(ctx, template);

  if (options.answers) fillAnswers(form, options.answers, ctx.fieldPrefix);
}

/**
 * Set the sheet's interactive fields from a stored survey response. Numeric
 * values select the matching radio bubble; string values fill the text field
 * of the same name. `prefix` matches the field namespace used when the sheet
 * was drawn. Both lookups are guarded, so a key that isn't a field on this
 * particular template (or a value with no matching bubble) is skipped rather
 * than throwing — letting one response object drive any template.
 */
function fillAnswers(form: PDFForm, answers: Record<string, number | string>, prefix = ''): void {
  for (const [key, value] of Object.entries(answers)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      try {
        form.getRadioGroup(prefix + key).select(String(value));
      } catch {
        /* not a radio group on this sheet, or no bubble for this value */
      }
    } else {
      const text = String(value);
      if (!text) continue;
      try {
        form.getTextField(prefix + key).setText(text);
      } catch {
        /* not a text field on this sheet */
      }
    }
  }
}

/**
 * A single combined PDF holding one answer sheet per entry, laid into one
 * interactive form so the whole document stays fillable — the "all tests"
 * download. Any stored answers are pre-filled; the recipient can still adjust
 * them. Every sheet's fields are namespaced (`t0_`, `t1_`, …) so the shared
 * `patient_name`/`other_comments` fields don't collide across sheets.
 */
export async function generateCombinedAnswerSheets(
  entries: { template: OmrTemplate; answers?: Record<string, number | string> }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('All Tests');
  doc.setSubject('Assessment forms');
  doc.setProducer('PATH — Pain Assessment Tools Hub');
  doc.setCreator('PATH');
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  entries.forEach((entry, i) => {
    renderSheet(doc, font, fontBold, form, entry.template, {
      answers: entry.answers,
      fieldPrefix: `t${i}_`,
    });
  });

  return doc.save();
}

/** Suggested download filename for a blank sheet. */
export function buildAnswerSheetFilename(template: OmrTemplate): string {
  return `${template.id}_answer_sheet.pdf`;
}

/** Suggested download filename for the combined completed-tests record. */
export function buildCombinedAnswerSheetFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `completed_tests_${today}.pdf`;
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
  // Subtitle is optional; when omitted, the instructions box moves up to
  // reclaim the space (used by MSI to fit its grid + comments on one page).
  const hasSubtitle = template.subtitle.trim().length > 0;
  if (hasSubtitle) {
    ctx.page.drawText(template.subtitle, {
      x: MARGIN_X,
      y: at(98),
      size: 10.5,
      font: ctx.font,
      color: COLOR_MUTED,
    });
  }

  // Instructions callout — a tinted, bordered panel so the fill-out rules
  // read as important, not fine print. Each instruction wraps within the box
  // so long lines don't spill past the border. Sits above the bubble grid, so
  // the background never touches a mark the reader has to sample.
  const boxTop = hasSubtitle ? 116 : 100;
  const lineGap = 16;
  const exampleRowH = 22; // "How to mark" reference row at the box bottom
  const textWidth = contentW - 40; // bullet indent + right padding
  const wrapped = template.instructions.map((line) => wrapText(line, textWidth, ctx.font, 9.5));
  const totalLines = wrapped.reduce((n, lines) => n + lines.length, 0);
  const boxHeight = 34 + totalLines * lineGap + exampleRowH;
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
  let lineIdx = 0;
  for (const lines of wrapped) {
    lines.forEach((line, k) => {
      const y = at(boxTop + 38 + lineIdx * lineGap);
      if (k === 0) {
        ctx.page.drawText('•', { x: MARGIN_X + 14, y, size: 10, font: ctx.fontBold, color: COLOR_PRIMARY });
      }
      ctx.page.drawText(line, { x: MARGIN_X + 26, y, size: 9.5, font: ctx.font, color: COLOR_TEXT });
      lineIdx += 1;
    });
  }

  // "How to mark" reference: show a correctly-filled bubble and a crossed-out
  // (changed-answer) one, so respondents can see the intended marks at a glance.
  const exY = at(boxTop + 38 + totalLines * lineGap + 4);
  ctx.page.drawText('How to mark:', { x: MARGIN_X + 14, y: exY, size: 9.5, font: ctx.fontBold, color: COLOR_PRIMARY });
  let exX = MARGIN_X + 14 + ctx.fontBold.widthOfTextAtSize('How to mark:', 9.5) + 14;
  drawBubbleGlyph(ctx, exX + 5, exY + 3, 'filled');
  ctx.page.drawText('Fill completely', { x: exX + 15, y: exY, size: 9.5, font: ctx.font, color: COLOR_TEXT });
  exX += 15 + ctx.font.widthOfTextAtSize('Fill completely', 9.5) + 22;
  drawBubbleGlyph(ctx, exX + 5, exY + 3, 'crossed');
  ctx.page.drawText('Cross out to change', { x: exX + 16, y: exY, size: 9.5, font: ctx.font, color: COLOR_TEXT });

  // Patient / date line: printed labels with interactive, typeable fields
  // (underlined so a hand-filled printout looks the same). Not machine-read
  // from a scan; captured only when the PDF is filled on a computer.
  const nameY = at(boxTop + boxHeight + 30);
  const nameLabel = 'Name / ID:';
  const dateLabel = 'Date:';
  const nameLabelW = ctx.font.widthOfTextAtSize(nameLabel, 9.5);
  const dateLabelW = ctx.font.widthOfTextAtSize(dateLabel, 9.5);
  const dateFieldW = 110;
  const dateLabelX = ctx.pageW - MARGIN_X - dateFieldW - dateLabelW - 8;
  const nameFieldX = MARGIN_X + nameLabelW + 8;
  const nameFieldW = dateLabelX - nameFieldX - 24;

  ctx.page.drawText(nameLabel, { x: MARGIN_X, y: nameY, size: 9.5, font: ctx.font, color: COLOR_INK });
  drawUnderlinedField(ctx, 'patient_name', nameFieldX, nameY, nameFieldW);
  ctx.page.drawText(dateLabel, { x: dateLabelX, y: nameY, size: 9.5, font: ctx.font, color: COLOR_INK });
  drawUnderlinedField(ctx, 'patient_date', dateLabelX + dateLabelW + 8, nameY, dateFieldW);
}

/** A single-line interactive text field drawn as an underline, so the printed
 *  sheet reads like a fill-in blank but the PDF is typeable on a computer. */
function drawUnderlinedField(ctx: Ctx, name: string, xPt: number, baselineYpt: number, widthPt: number): void {
  const field = ctx.form.createTextField(ctx.fieldPrefix + name);
  field.setText('');
  field.addToPage(ctx.page, {
    x: xPt,
    y: baselineYpt - 3,
    width: widthPt,
    height: 13,
    borderWidth: 0,
    font: ctx.font,
    textColor: COLOR_INK,
  });
  field.setFontSize(10);
  ctx.page.drawLine({
    start: { x: xPt, y: baselineYpt - 4 },
    end: { x: xPt + widthPt, y: baselineYpt - 4 },
    thickness: 0.75,
    color: COLOR_SUBTLE,
  });
}

const LABEL_X = MARGIN_X + 18; // leaves room for the row number
const RADIUS_TO_CONTENT = 6; // bubble radius fallback for extents

function drawSection(ctx: Ctx, section: OmrSection, template: OmrTemplate): void {
  const radiusPt = template.bubbleRadius * ctx.pageW || RADIUS_TO_CONTENT;
  const contentW = ctx.pageW - 2 * MARGIN_X;

  // Vertical extent of the bubble grid.
  const allY = section.rows.flatMap((r) => r.fields.flatMap((f) => f.bubbles.map((b) => b.center.y)));
  const firstRowYpt = toY(ctx, Math.min(...allY));
  const lastRowYpt = toY(ctx, Math.max(...allY));

  // Horizontal extent of the bubble grid (for separators / divider).
  const allX = section.columnGroups.flatMap((g) => g.columnX);
  const gridLeftPt = toX(ctx, Math.min(...allX)) - radiusPt;
  const gridRightPt = toX(ctx, Math.max(...allX)) + radiusPt;

  // Give row 1 the same top margin as the half-gap between subsequent rows,
  // so its content is vertically centered in its cell rather than crowded
  // against the header rule.
  const rowGapPt =
    section.rows.length > 1
      ? firstRowYpt - toY(ctx, section.rows[1].fields[0].bubbles[0].center.y)
      : 40;
  const topGap = Math.max(14, rowGapPt / 2);
  const ruleY = firstRowYpt + topGap;

  // Per-column option headers wrap to their column width, so word labels
  // (e.g. FreBAQ's "Occasionally", PHQ-4's "More than half the days") can sit
  // directly under each bubble as a self-describing radio group instead of
  // relying on a separate decode legend. Short/number headers stay one line.
  const HEADER_SIZE = 9;
  const HEADER_LH = 10;
  const columnWidthPt = (group: OmrColumnGroup): number => {
    if (group.columnX.length < 2) return 60;
    let min = Infinity;
    for (let i = 1; i < group.columnX.length; i += 1) {
      min = Math.min(min, (group.columnX[i] - group.columnX[i - 1]) * ctx.pageW);
    }
    return min;
  };
  const wrappedHeaders = section.columnGroups.map((g) => {
    const w = columnWidthPt(g) - 6;
    return g.optionHeaders.map((h) => wrapText(h, w, ctx.font, HEADER_SIZE));
  });
  const maxHeaderLines = Math.max(1, ...wrappedHeaders.flat().map((l) => l.length));

  const headersBottomY = ruleY + 8; // baseline of the lowest header line
  const groupHeaderY = headersBottomY + maxHeaderLines * HEADER_LH + 6;

  // Group heading, then each column's (possibly multi-line) header stacked
  // upward from just above the rule.
  section.columnGroups.forEach((group, gi) => {
    const centerX =
      (toX(ctx, group.columnX[0]) + toX(ctx, group.columnX[group.columnX.length - 1])) / 2;
    drawCentered(ctx, group.label, centerX, groupHeaderY, 10, ctx.fontBold, COLOR_PRIMARY);
    wrappedHeaders[gi].forEach((lines, i) => {
      lines.forEach((line, k) => {
        const y = headersBottomY + (lines.length - 1 - k) * HEADER_LH;
        drawCentered(ctx, line, toX(ctx, group.columnX[i]), y, HEADER_SIZE, ctx.font, COLOR_MUTED);
      });
    });
  });

  // Legend lines above the group header, then the section title, then an
  // optional wrapped preamble above that.
  const legendTopY = groupHeaderY + 18 + Math.max(0, section.legend.length - 1) * 12;
  section.legend.forEach((line, k) => {
    ctx.page.drawText(line, { x: MARGIN_X, y: legendTopY - k * 12, size: 8.5, font: ctx.font, color: COLOR_MUTED });
  });
  // Section title (wraps for long headings), bottom line at titleY. Optional:
  // an empty title is skipped and reserves no space, letting the grid sit
  // higher (used by MSI's single-page layout).
  const titleY = section.legend.length ? legendTopY + 16 : groupHeaderY + 18;
  const titleLines = section.title.trim().length ? wrapText(section.title, contentW, ctx.fontBold, 13) : [];
  const titleTopY = titleY + Math.max(0, titleLines.length - 1) * 15;
  titleLines.forEach((line, k) => {
    ctx.page.drawText(line, { x: MARGIN_X, y: titleTopY - k * 15, size: 13, font: ctx.fontBold, color: COLOR_INK });
  });
  if (section.preamble) {
    // Same treatment as the section title (bold, dark), reading as a heading,
    // with a blank-line gap so the two sentences don't run together. When the
    // preamble asks for a short answer, reserve a line under it for an
    // interactive fill-in blank.
    const preLines = wrapText(section.preamble, contentW, ctx.fontBold, 13);
    const fieldRoom = section.preambleField ? 26 : 0;
    const preTopY = titleTopY + 34 + fieldRoom + (preLines.length - 1) * 15;
    preLines.forEach((line, k) => {
      ctx.page.drawText(line, { x: MARGIN_X, y: preTopY - k * 15, size: 13, font: ctx.fontBold, color: COLOR_INK });
    });
    if (section.preambleField) {
      const preBottomY = preTopY - (preLines.length - 1) * 15; // last preamble line
      const fieldBaselineY = preBottomY - 20;
      const hintText = section.preambleField.hint ? `(${section.preambleField.hint})` : '';
      const hintW = hintText ? ctx.font.widthOfTextAtSize(hintText, 9) + 12 : 0;
      const fieldW = Math.min(280, contentW - hintW - 8);
      drawUnderlinedField(ctx, section.preambleField.key, MARGIN_X, fieldBaselineY, fieldW);
      if (hintText) {
        ctx.page.drawText(hintText, {
          x: MARGIN_X + fieldW + 12,
          y: fieldBaselineY,
          size: 9,
          font: ctx.font,
          color: COLOR_MUTED,
        });
      }
    }
  }

  // Light divider between two column groups, plus the header rule.
  if (section.columnGroups.length === 2) {
    const gap =
      (toX(ctx, section.columnGroups[0].columnX.at(-1)!) +
        toX(ctx, section.columnGroups[1].columnX[0])) /
      2;
    ctx.page.drawLine({
      start: { x: gap, y: ruleY - 6 },
      end: { x: gap, y: lastRowYpt - radiusPt - 4 },
      thickness: 0.5,
      color: COLOR_HAIRLINE,
    });
  }
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ruleY },
    end: { x: gridRightPt, y: ruleY },
    thickness: 0.5,
    color: COLOR_HAIRLINE,
  });

  // Rows: number, label (+ optional description), bubbles, hairline separator.
  section.rows.forEach((row, i) => {
    const yPt = toY(ctx, row.fields[0].bubbles[0].center.y);

    // Wrap the label (and any description) to the space left of the grid, and
    // vertically center the whole text block on the row so short (MSI) and long
    // (FreBAQ/BriefSLANSS) items both look right.
    const labelMaxWidth = Math.max(60, gridLeftPt - LABEL_X - 12);
    const LH = 13;
    const DLH = 11;
    const labelLines = wrapText(row.label, labelMaxWidth, ctx.font, 11);
    const descLines = row.description ? wrapText(row.description, labelMaxWidth, ctx.font, 9) : [];
    const blockH = labelLines.length * LH + (descLines.length ? 4 + descLines.length * DLH : 0);
    const topY = yPt + blockH / 2; // bottom-left coords: higher y = up

    ctx.page.drawText(`${i + 1}`, {
      x: MARGIN_X,
      y: topY - LH + 1,
      size: 10.5,
      font: ctx.fontBold,
      color: COLOR_SUBTLE,
    });
    labelLines.forEach((line, k) => {
      ctx.page.drawText(line, {
        x: LABEL_X,
        y: topY - (k + 1) * LH + 1,
        size: 11,
        font: ctx.font,
        color: COLOR_INK,
      });
    });
    descLines.forEach((line, j) => {
      ctx.page.drawText(line, {
        x: LABEL_X,
        y: topY - labelLines.length * LH - 3 - (j + 1) * DLH + 3,
        size: 9,
        font: ctx.font,
        color: COLOR_MUTED,
      });
    });

    for (const field of row.fields) {
      // One radio group per field: the bubbles are mutually exclusive, so the
      // sheet reads as a proper radio-button group and can be filled on-screen.
      // Each group name is the field's scorer key, which is unique per sheet.
      const group = ctx.form.createRadioGroup(ctx.fieldPrefix + field.key);
      for (const bubble of field.bubbles) {
        const cx = toX(ctx, bubble.center.x);
        const cy = toY(ctx, bubble.center.y);
        // Printed bubble outline — the single truth the reader samples; left
        // exactly as before so hand-filled, printed, and scanned sheets are
        // unchanged.
        ctx.page.drawCircle({ x: cx, y: cy, size: radiusPt, borderColor: COLOR_INK, borderWidth: 1 });
        // Interactive radio widget overlaid on the same spot. Borderless, so a
        // blank sheet looks identical on paper; selecting on-screen draws a
        // centered dot inside the printed ring.
        group.addOptionToPage(String(bubble.value), ctx.page, {
          x: cx - radiusPt,
          y: cy - radiusPt,
          width: radiusPt * 2,
          height: radiusPt * 2,
          borderWidth: 0,
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
  drawFooterOn(ctx, ctx.page, template);
}

function drawFooterOn(ctx: Ctx, page: PDFPage, template: OmrTemplate): void {
  const text = `${template.title} · Form ${template.id} · Generated by PATH`;
  const w = ctx.font.widthOfTextAtSize(text, 7.5);
  page.drawText(text, {
    x: (ctx.pageW - w) / 2,
    y: 28,
    size: 7.5,
    font: ctx.font,
    color: COLOR_SUBTLE,
  });
}

/**
 * An interactive multi-line "Comments (optional)" box, mirroring the free-text
 * field on the on-screen surveys (its `other_comments` key matches, so a
 * computer-filled sheet flows into the same place). Placed below the answer
 * grid when there's room; on a grid that fills the page (MSI), it spills onto
 * a second page so it never crowds the last rows or the fiducials.
 */
function drawCommentBox(ctx: Ctx, template: OmrTemplate): void {
  const allY = template.sections.flatMap((s) =>
    s.rows.flatMap((r) => r.fields.flatMap((f) => f.bubbles.map((b) => b.center.y))),
  );
  const radiusPt = template.bubbleRadius * ctx.pageW || RADIUS_TO_CONTENT;
  const gridBottomYpt = toY(ctx, Math.max(...allY)) - radiusPt;

  const contentW = ctx.pageW - 2 * MARGIN_X;
  const labelGap = 6; // between label and box
  // Gap between the grid and the label. Generous, because a row's wrapped text
  // can descend below its bubble centers (which is what `gridBottomYpt` tracks).
  const gapAboveLabel = 30;
  const MAX_BOX_H = 56;
  const MIN_BOX_H = 40;
  // Keep the box clear of the bottom-left orientation mark and corner
  // fiducials, so a written comment can never obscure a registration mark on
  // the scannable page.
  const SAFE_BOTTOM_Y = 68;

  // How tall a box fits under the grid on this page, before overflowing.
  const fitBoxH = gridBottomYpt - SAFE_BOTTOM_Y - gapAboveLabel - labelGap;

  let page = ctx.page;
  let boxH: number;
  let labelBaselineY: number;
  if (fitBoxH >= MIN_BOX_H) {
    boxH = Math.min(fitBoxH, MAX_BOX_H);
    labelBaselineY = gridBottomYpt - gapAboveLabel;
  } else {
    // A grid that fills the page (MSI) leaves no safe room — give comments
    // their own page, at full height.
    boxH = MAX_BOX_H;
    page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
    page.drawText('PATH', { x: MARGIN_X, y: ctx.pageH - 60, size: 13, font: ctx.fontBold, color: COLOR_PRIMARY });
    page.drawText(`${template.title} — Comments`, {
      x: MARGIN_X,
      y: ctx.pageH - 88,
      size: 13,
      font: ctx.fontBold,
      color: COLOR_INK,
    });
    drawFooterOn(ctx, page, template);
    labelBaselineY = ctx.pageH - 120;
  }

  page.drawText('Comments (optional)', {
    x: MARGIN_X,
    y: labelBaselineY,
    size: 9.5,
    font: ctx.fontBold,
    color: COLOR_PRIMARY,
  });
  const boxTopY = labelBaselineY - labelGap;
  page.drawRectangle({
    x: MARGIN_X,
    y: boxTopY - boxH,
    width: contentW,
    height: boxH,
    borderColor: COLOR_TINT_BORDER,
    borderWidth: 1,
  });

  const field = ctx.form.createTextField(ctx.fieldPrefix + 'other_comments');
  field.setText('');
  field.enableMultiline();
  field.addToPage(page, {
    x: MARGIN_X + 4,
    y: boxTopY - boxH + 4,
    width: contentW - 8,
    height: boxH - 8,
    borderWidth: 0,
    font: ctx.font,
    textColor: COLOR_INK,
  });
  field.setFontSize(10);
}
