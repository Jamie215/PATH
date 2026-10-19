/**
 * Configuration for the Pain Classification composite assessment.
 *
 * Pain Classification is a *parent* assessment: it collects the results of
 * four child assessments (MSI, BriefSLANSS, FreBAQ, PHQ-4) and combines them
 * into a single classification.
 *
 * The user reaches this from the hub, answers two intake questions
 * (pain type + role), and — for the acute pathway — lands on a collection
 * page where each child assessment's result can come from any of:
 *
 *   1. "Take the test" — the child's survey inline in a modal (pre-filled to
 *      "Edit the response" once answered), which writes its result back here;
 *   2. Manual entry — the user types the child's sub-scores directly; or
 *   3. A completed-tests upload — one filled/scanned/photographed packet read
 *      and routed to the children (handled by the collection page, not here).
 *
 * This file is the single source of truth for how the children are wired into
 * the composite (collection, patient flow, review and results pages), so
 * wiring a child differently — or adjusting the manual-entry fields — is a
 * one-place change. Score ranges come from each child's own scoring module.
 */

import type { OmrTemplate } from '../omr/types';
import { MSI_OMR_TEMPLATE } from '../msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../briefslanss/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../frebaq/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../phq4/omr-template';
import { MAX as MSI_MAX } from '../msi/scoring';
import { MAX_SCORE as SLANSS_MAX } from '../briefslanss/scoring';
import { MAX_SCORE as FREBAQ_MAX } from '../frebaq/scoring';
import { MAX_SCORE as PHQ4_MAX } from '../phq4/scoring';

export type PainType = 'acute' | 'chronic';

/** Kept as 'professional' to match the child assessments' stored role values. */
export type Role = 'patient' | 'professional';

export interface ManualField {
  /** Key within the child's per-slug manual record. */
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}

export interface ChildAssessment {
  slug: string;
  title: string;
  shortName: string;
  /**
   * One-line explanation of what the assessment measures. Shown as the card
   * and modal subtitle — the friendly title alone would otherwise just repeat
   * itself, so the subtitle carries the description instead.
   */
  description: string;
  /** sessionStorage key (sans the `path:` prefix) the child writes its scored result to. */
  resultKey: string;
  /**
   * Manual-entry fields — the raw sub-scores the composite model consumes
   * (see ./scoring.ts): MSI somatic/central, and each screener's total.
   */
  manualFields: ManualField[];
  /**
   * Pull the manual-field values out of a stored child result, so a child
   * completed via questionnaire feeds the composite the same shape as a
   * manual entry. Returns null if the stored result is missing/unusable.
   */
  fromResult: (result: unknown) => Record<string, number> | null;
  /**
   * If set, this child has a printable/fillable OMR answer sheet, and can be
   * satisfied by uploading it (filled PDF, scan, or photo). The reader decodes
   * the sheet against this template; the user then confirms via the child's own
   * survey before it feeds the composite. All four acute children have a sheet.
   */
  omrTemplate?: OmrTemplate;
  /**
   * If set, the card shows an editable free-text field for a context value the
   * child collects alongside its score — currently FreBAQ's "most bothersome
   * area", mirroring the input offered in the scan/OCR review. The typed value
   * is stored on the child's `${slug}:response` under `bothersome_area`.
   */
  areaField?: { label: string; placeholder: string };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** `fromResult` for the single-total screeners: their result's `total_score`. */
function totalFromResult(r: unknown): Record<string, number> | null {
  const total = num((r as Record<string, unknown> | null)?.total_score);
  return total === null ? null : { total_score: total };
}

const totalField = (max: number): ManualField[] => [
  { key: 'total_score', label: 'Total score', min: 0, max },
];

/** Child assessments composing the ACUTE pain-classification pathway. */
export const ACUTE_CHILDREN: ChildAssessment[] = [
  {
    slug: 'msi',
    title: 'Symptom Index',
    shortName: 'Symptom Index',
    description:
      'A ten-symptom screening that gathers frequency and bothersomeness ratings.',
    resultKey: 'msi:result',
    manualFields: [
      { key: 'somatic', label: 'Somatic score', min: 0, max: MSI_MAX.somatic },
      { key: 'nonsomatic', label: 'Central (non-somatic) score', min: 0, max: MSI_MAX.nonsomatic },
    ],
    fromResult: (r) => {
      const o = r as Record<string, unknown> | null;
      if (!o) return null;
      const somatic = num(o.somatic);
      const nonsomatic = num(o.nonsomatic);
      if (somatic === null || nonsomatic === null) return null;
      return { somatic, nonsomatic };
    },
    omrTemplate: MSI_OMR_TEMPLATE,
  },
  {
    slug: 'briefslanss',
    title: 'Sensory Profile',
    shortName: 'Sensory Profile',
    description:
      'A brief screening for neuropathic pain, with four symptom questions.',
    resultKey: 'briefslanss:result',
    manualFields: totalField(SLANSS_MAX),
    omrTemplate: BRIEFSLANSS_OMR_TEMPLATE,
    fromResult: totalFromResult,
  },
  {
    slug: 'frebaq',
    title: 'Body Awareness',
    shortName: 'Body Awareness',
    description:
      'A quantitative evaluation of area-specific self-perception.',
    resultKey: 'frebaq:result',
    manualFields: totalField(FREBAQ_MAX),
    omrTemplate: FREBAQ_OMR_TEMPLATE,
    areaField: {
      label: 'The part of the body that has been bothering me the most is:',
      placeholder: 'e.g., right knee, left hand, neck',
    },
    fromResult: totalFromResult,
  },
  {
    slug: 'phq4',
    title: 'Anxiety & Depression',
    shortName: 'Anxiety & Depression',
    description:
      'A brief screening for depression and anxiety.',
    resultKey: 'phq4:result',
    manualFields: totalField(PHQ4_MAX),
    omrTemplate: PHQ4_OMR_TEMPLATE,
    fromResult: totalFromResult,
  },
];

/** sessionStorage keys owned by the parent (sans the `path:` prefix). */
export const KEYS = {
  role: 'pain-classification:role',
  /** Manual entry for a child is stored at `${manualPrefix}${slug}`. */
  manualPrefix: 'pain-classification:manual:',
  /** Optional per-child comment is stored at `${commentPrefix}${slug}`. */
  commentPrefix: 'pain-classification:comment:',
  /** Patient name / ID for the composite report. */
  patientName: 'pain-classification:patientName',
} as const;

export const RETURN_URL = '/pain-classification/acute/';
