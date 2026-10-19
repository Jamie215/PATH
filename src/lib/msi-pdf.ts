/**
 * MSI PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable; charts are embedded as PNG rasterizations of the existing
 * Chart.js canvases. Shared layout/primitives live in ./pdf/report-kit; the
 * summary-score, screening, and chart sections below are MSI-specific.
 */
import { type PDFDocument, type PDFImage } from 'pdf-lib';
import {
  MAX,
  SUMMARY_MEASURES,
  targetScore,
  type MSIResult,
} from '../assessments/msi/scoring';
import type { MSIRole } from '../assessments/msi/questions';
import {
  buildFilename as kitBuildFilename,
  createReport,
  drawComments,
  drawRule,
  drawSectionHeading,
  drawText,
  drawTitle,
  finalizeReport,
  moveDown,
  ensureSpace,
  COLOR_DANGER,
  COLOR_MUTED,
  COLOR_PRIMARY,
  COLOR_SUCCESS,
  COLOR_TINT,
  COLOR_WARNING,
  CONTENT_W,
  MARGIN_X,
  type Ctx,
} from './pdf/report-kit';

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
  const ctx = await createReport({
    title: 'Symptom Index Results',
    subject: 'Symptom Index — clinical results',
  });

  const barImg = await embedPng(ctx.doc, input.chartImages.somaticBar);
  const radarImg = await embedPng(ctx.doc, input.chartImages.radar);

  drawTitle(ctx, {
    title: 'Symptom Index',
    subtitle: 'Results report',
    patientName: input.patientName,
  });
  drawSummaryScores(ctx, input.result);
  if (input.role === 'professional') {
    drawScreening(ctx, input.result);
  }
  drawComments(ctx, input.result.comments);
  drawCharts(ctx, barImg, radarImg);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  return kitBuildFilename('Symptom_Index_Results', patientName);
}

// ---------------------------------------------------------------------------
// PNG embedding
// ---------------------------------------------------------------------------

async function embedPng(doc: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  return doc.embedPng(bytes);
}

// ---------------------------------------------------------------------------
// MSI-specific sections
// ---------------------------------------------------------------------------

function drawSummaryScores(ctx: Ctx, result: MSIResult): void {
  drawSectionHeading(ctx, 'Summary scores');

  const fmt = (n: number, decimals: 0 | 1) =>
    decimals === 0 ? Math.round(n).toString() : n.toFixed(1);
  const pct = (v: number, max: number) => `${Math.round((v / max) * 100)}%`;

  const rows: [string, string, string][] = SUMMARY_MEASURES.map(({ key, label, decimals }) => [
    label,
    `${fmt(result[key], decimals)} (${pct(result[key], MAX[key])})`,
    fmt(targetScore(result, key), decimals),
  ]);

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

function drawCharts(ctx: Ctx, barImg: PDFImage, radarImg: PDFImage): void {
  // Charts together need ~480pt; start a new page rather than split them.
  ensureSpace(ctx, 480);

  drawSectionHeading(ctx, 'Charts');

  // Somatic vs non-somatic bar — embed at content width, scaled.
  const barTargetW = CONTENT_W;
  const barAspect = barImg.height / barImg.width;
  const barTargetH = Math.min(barTargetW * barAspect, 160);
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
