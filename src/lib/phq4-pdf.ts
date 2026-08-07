/**
 * PHQ-4 PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable. Shared layout/primitives live in ./pdf/report-kit; this
 * module supplies only what's specific to the PHQ-4 report.
 */
import type { phq4Result } from '../assessments/phq4/scoring';
import {
  buildFilename as kitBuildFilename,
  createReport,
  drawComments,
  drawNote,
  drawScoreCard,
  drawTitle,
  finalizeReport,
} from './pdf/report-kit';

export interface PDFInput {
  result: phq4Result;
  patientName: string;
}

const ELEVATED_THRESHOLD = 3; // mild or worse on the 0–12 PHQ-4 total

export async function generatePHQ4Report(input: PDFInput): Promise<Uint8Array> {
  const ctx = await createReport({
    title: 'Anxiety & Depression Results',
    subject: 'Anxiety & Depression — clinical screening results',
  });

  drawTitle(ctx, {
    title: 'PHQ-4',
    subtitle: 'Anxiety & Depression — results report',
    patientName: input.patientName,
  });
  drawScoreCard(ctx, {
    score: input.result.total_score,
    interpretation: input.result.interpretation,
    elevated: input.result.total_score >= ELEVATED_THRESHOLD,
  });
  drawNote(
    ctx,
    'PHQ-4 total score bands: 0–2 normal, 3–5 mild, 6–8 moderate, 9–12 severe ' +
      'psychological distress (combined anxiety and depression screen). This is a ' +
      'screening result, not a diagnosis.',
    { trailing: 12 },
  );
  drawComments(ctx, input.result.comments);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  return kitBuildFilename('Anxiety_Depression_Results', patientName);
}
