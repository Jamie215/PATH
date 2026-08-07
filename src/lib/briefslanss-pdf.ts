/**
 * briefSLANSS PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable. Shared layout/primitives live in ./pdf/report-kit; this
 * module supplies only what's specific to the briefSLANSS report.
 */
import type { briefSLANSSResult } from '../assessments/briefslanss/scoring';
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
  result: briefSLANSSResult;
  patientName: string;
}

const NEUROPATHIC_THRESHOLD = 3; // matches scoring.ts: neuropathic when total > 2

export async function generateBriefSLANSSReport(input: PDFInput): Promise<Uint8Array> {
  const ctx = await createReport({
    title: 'Sensory Profile Results',
    subject: 'Sensory Profile — clinical screening results',
  });

  drawTitle(ctx, {
    title: 'Sensory Profile',
    subtitle: 'Brief neuropathic symptoms and signs — results report',
    patientName: input.patientName,
  });
  drawScoreCard(ctx, {
    score: input.result.total_score,
    interpretation: input.result.interpretation,
    elevated: input.result.total_score >= NEUROPATHIC_THRESHOLD,
  });
  drawNote(
    ctx,
    `Scores at or above ${NEUROPATHIC_THRESHOLD} suggest a predominantly neuropathic pain ` +
      'mechanism. This is a screening result, not a diagnosis.',
    { trailing: 12 },
  );
  drawComments(ctx, input.result.comments);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  return kitBuildFilename('Sensory_Profile_Results', patientName);
}
