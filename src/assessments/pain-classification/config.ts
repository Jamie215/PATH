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
import { get as storeGet, keys } from '../../lib/storage';
import { assessmentBySlug, type AssessmentSummary } from '../registry';
import { MSI_OMR_TEMPLATE } from '../msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../briefslanss/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../frebaq/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../phq4/omr-template';
import { AREA_HINT } from '../frebaq/questions';
import { MAX as MSI_MAX } from '../msi/scoring';
import { MAX_SCORE as SLANSS_MAX } from '../briefslanss/scoring';
import { MAX_SCORE as FREBAQ_MAX } from '../frebaq/scoring';
import { MAX_SCORE as PHQ4_MAX } from '../phq4/scoring';

export type PainType = 'acute' | 'chronic';

export type { Role } from '../registry';

export interface ManualField {
  /** Key within the child's per-slug manual record. */
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}

/** Name and description come from the hub registry (`assessmentBySlug`). */
export interface ChildAssessment extends ChildMeta {
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
   * is stored in the child's survey response under `bothersome_area`.
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

type ChildMeta = Pick<AssessmentSummary, 'slug' | 'title' | 'shortName' | 'description'>;

/** A child's name, short name and description, from the hub registry. */
function meta(slug: string): ChildMeta {
  const { title, shortName, description } = assessmentBySlug(slug);
  return { slug, title, shortName, description };
}

const totalField = (max: number): ManualField[] => [
  { key: 'total_score', label: 'Total score', min: 0, max },
];

/** Child assessments composing the ACUTE pain-classification pathway. */
export const ACUTE_CHILDREN: ChildAssessment[] = [
  {
    ...meta('msi'),
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
    ...meta('briefslanss'),
    manualFields: totalField(SLANSS_MAX),
    omrTemplate: BRIEFSLANSS_OMR_TEMPLATE,
    fromResult: totalFromResult,
  },
  {
    ...meta('frebaq'),
    manualFields: totalField(FREBAQ_MAX),
    omrTemplate: FREBAQ_OMR_TEMPLATE,
    areaField: {
      label: 'The part of the body that has been bothering me the most is:',
      placeholder: AREA_HINT,
    },
    fromResult: totalFromResult,
  },
  {
    ...meta('phq4'),
    manualFields: totalField(PHQ4_MAX),
    omrTemplate: PHQ4_OMR_TEMPLATE,
    fromResult: totalFromResult,
  },
];

/** sessionStorage keys owned by the parent (sans the `path:` prefix). */
export const KEYS = {
  role: keys.role('pain-classification'),
  /** Manual entry for a child is stored at `${manualPrefix}${slug}`. */
  manualPrefix: 'pain-classification:manual:',
  /** Optional per-child comment is stored at `${commentPrefix}${slug}`. */
  commentPrefix: 'pain-classification:comment:',
  /** Patient name / ID for the composite report. */
  patientName: keys.patientName('pain-classification'),
} as const;

/**
 * True when `values` holds a finite number for every one of the child's
 * manual fields — the rule for a child counting as "complete" everywhere
 * (collection cards, patient review, classification results).
 */
export function hasAllFields(
  child: ChildAssessment,
  values: Record<string, number | undefined> | null | undefined,
): boolean {
  return !!values && child.manualFields.every((f) => Number.isFinite(values[f.key]));
}

/**
 * Every child's stored values, keyed by slug — the composite model's inputs.
 * Null if any child is still incomplete, so callers send the user back to the
 * collection page instead of scoring partial data.
 */
export function loadChildInputs(): Record<string, Record<string, number>> | null {
  const inputs: Record<string, Record<string, number>> = {};
  for (const child of ACUTE_CHILDREN) {
    const values = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
    if (!values || !hasAllFields(child, values)) return null;
    inputs[child.slug] = values;
  }
  return inputs;
}
