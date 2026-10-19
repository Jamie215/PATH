/**
 * PDF report generator for the single-total screeners (PHQ-4, Brief S-LANSS,
 * FreBAQ). The three reports share one layout; everything that differs comes
 * from their `ScreenerReport` spec (assessments/screener-reports.ts).
 *
 * Lazy-imported by the results view so pdf-lib only loads on download.
 */
import type { ScreenerReport } from '../assessments/screener-reports';
import type { ScreenerResult } from '../assessments/screening';
import {
  buildFilename as kitBuildFilename,
  createReport,
  drawComments,
  drawNote,
  drawScoreCard,
  drawTitle,
  finalizeReport,
} from './pdf/report-kit';

export async function generateScreeningReport(
  spec: ScreenerReport,
  input: { result: ScreenerResult; patientName: string },
): Promise<Uint8Array> {
  const ctx = await createReport({
    title: `${spec.name} Results`,
    subject: `${spec.name} — clinical screening results`,
  });

  drawTitle(ctx, {
    title: spec.pdfHeading,
    subtitle: spec.pdfSubtitle,
    patientName: input.patientName,
  });
  drawScoreCard(ctx, {
    score: input.result.total_score,
    interpretation: input.result.interpretation,
    elevated: spec.scoring.isElevated(input.result.total_score),
  });
  drawNote(ctx, spec.note, { trailing: 12 });
  drawComments(ctx, input.result.comments);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(spec: ScreenerReport, patientName: string): string {
  return kitBuildFilename(spec.filenamePrefix, patientName);
}
