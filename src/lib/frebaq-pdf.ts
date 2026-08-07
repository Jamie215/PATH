/**
 * FreBAQ PDF report generator.
 *
 * Produces a clean, text-based PDF using pdf-lib. All text remains selectable
 * and searchable. Shared layout/primitives live in ./pdf/report-kit; this
 * module supplies only what's specific to the FreBAQ report.
 */
import type { freBAQResult } from '../assessments/frebaq/scoring';
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
  result: freBAQResult;
  patientName: string;
}

const ELEVATED_THRESHOLD = 12; // mirrors FreBAQResults.svelte (upper half of 0–24)

export async function generateFreBAQReport(input: PDFInput): Promise<Uint8Array> {
  const ctx = await createReport({
    title: 'Body Awareness Results',
    subject: 'Body Awareness — clinical screening results',
  });

  drawTitle(ctx, {
    title: 'FreBAQ',
    subtitle: 'Body Awareness — results report',
    patientName: input.patientName,
  });
  drawScoreCard(ctx, {
    score: input.result.total_score,
    interpretation: input.result.interpretation,
    elevated: input.result.total_score >= ELEVATED_THRESHOLD,
  });
  drawNote(
    ctx,
    'The FreBAQ measures disrupted body perception (body awareness); higher ' +
      `scores indicate greater disruption. Scores at or above ${ELEVATED_THRESHOLD} ` +
      '(the upper half of the 0–24 range) are flagged as elevated. This is a ' +
      'screening result, not a diagnosis.',
    { trailing: 12 },
  );
  drawComments(ctx, input.result.comments);

  return finalizeReport(ctx);
}

/** Filename suggestion — sanitized for filesystem safety. */
export function buildFilename(patientName: string): string {
  return kitBuildFilename('Body_Awareness_Results', patientName);
}
