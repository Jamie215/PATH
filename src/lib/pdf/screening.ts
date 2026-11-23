/**
 * PDF report generator for the single-total screeners (PHQ-4, Brief S-LANSS,
 * FreBAQ). The reports share one layout; everything that differs comes from
 * the screener's definition (`report` in assessments/<slug>/definition.ts).
 *
 * Lazy-imported by the results view so pdf-lib only loads on download.
 */
import type { ScreenerDefinition, ScreenerResult } from '../../assessments/screening';
import { assessmentBySlug } from '../../assessments/registry';
import {
  buildFilename as kitBuildFilename,
  createReport,
  drawComments,
  drawNote,
  drawScoreCard,
  drawTitle,
  finalizeReport,
} from './report-kit';

export async function generateScreeningReport(
  spec: ScreenerDefinition,
  input: { result: ScreenerResult; patientName: string },
): Promise<Uint8Array> {
  const name = assessmentBySlug(spec.slug).title;
  const ctx = await createReport({
    title: `${name} Results`,
    subject: `${name} — clinical screening results`,
  });

  drawTitle(ctx, {
    title: spec.report.heading,
    subtitle: spec.report.subtitle,
    patientName: input.patientName,
  });
  drawScoreCard(ctx, {
    score: input.result.total_score,
    interpretation: input.result.interpretation,
    elevated: spec.scoring.isElevated(input.result.total_score),
  });
  drawNote(ctx, spec.report.note, { trailing: 12 });
  drawComments(ctx, input.result.comments);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(spec: ScreenerDefinition, patientName: string): string {
  return kitBuildFilename(spec.report.filenamePrefix, patientName);
}
