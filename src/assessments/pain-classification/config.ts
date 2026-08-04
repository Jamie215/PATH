/**
 * Configuration for the Pain Classification composite assessment.
 *
 * Pain Classification is a *parent* assessment: it collects the results of
 * four child assessments (MSI, BriefSLANSS, FreBAQ, PHQ-4) and combines them
 * into a single classification.
 *
 * The user reaches this from the hub, answers two intake questions
 * (pain type + role), and — for the acute pathway — lands on a collection
 * page where each child assessment can be satisfied two ways:
 *
 *   1. "Fill Out Questionnaire" — launches the child assessment (via
 *      assessment-context, so the child returns here when done), or
 *   2. Manual entry — the user types the child's result directly.
 *
 * This file is the single source of truth shared by the collection page and
 * the scoring module (./scoring.ts), so wiring a child differently — or
 * adjusting the manual-entry fields — is a one-place change.
 */

import type { OmrTemplate } from '../omr/types';
import { MSI_OMR_TEMPLATE } from '../msi/omr-template';
import { BRIEFSLANSS_OMR_TEMPLATE } from '../briefslanss/omr-template';
import { FREBAQ_OMR_TEMPLATE } from '../frebaq/omr-template';
import { PHQ4_OMR_TEMPLATE } from '../phq4/omr-template';

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
  /** sessionStorage key (sans the `path:` prefix) the child writes its scored result to. */
  resultKey: string;
  /** Where "Fill Out Questionnaire" sends the user. */
  surveyUrl: string;
  /**
   * If set, the parent copies its chosen role into this key before launching
   * the child, so a role-gated child survey (currently only MSI) doesn't
   * bounce back to its own intake.
   */
  roleKey?: string;
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
   * If set, this child can also be satisfied by uploading a scan/photo of its
   * printed OMR answer sheet. The reader decodes the sheet against this
   * template; the user then confirms via the child's own survey before it
   * feeds the composite. Only MSI has a sheet today.
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

/** Child assessments composing the ACUTE pain-classification pathway. */
export const ACUTE_CHILDREN: ChildAssessment[] = [
  {
    slug: 'msi',
    title: 'Symptom Index',
    shortName: 'Symptom Index',
    resultKey: 'msi:result',
    surveyUrl: '/msi/survey/',
    roleKey: 'msi:role',
    manualFields: [
      { key: 'somatic', label: 'Somatic score', min: 0, max: 60 },
      { key: 'nonsomatic', label: 'Central (non-somatic) score', min: 0, max: 72 },
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
    resultKey: 'briefslanss:result',
    surveyUrl: '/briefslanss/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 4 }],
    omrTemplate: BRIEFSLANSS_OMR_TEMPLATE,
    fromResult: (r) => {
      const total = num((r as Record<string, unknown> | null)?.total_score);
      return total === null ? null : { total_score: total };
    },
  },
  {
    slug: 'frebaq',
    title: 'Body Awareness',
    shortName: 'Body Awareness',
    resultKey: 'frebaq:result',
    surveyUrl: '/frebaq/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 24 }],
    omrTemplate: FREBAQ_OMR_TEMPLATE,
    areaField: {
      label: 'The part of the body that has been bothering the most is:',
      placeholder: 'e.g., right knee, left hand, neck',
    },
    fromResult: (r) => {
      const total = num((r as Record<string, unknown> | null)?.total_score);
      return total === null ? null : { total_score: total };
    },
  },
  {
    slug: 'phq4',
    title: 'Anxiety & Depression',
    shortName: 'Anxiety & Depression',
    resultKey: 'phq4:result',
    surveyUrl: '/phq4/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 12 }],
    omrTemplate: PHQ4_OMR_TEMPLATE,
    fromResult: (r) => {
      const total = num((r as Record<string, unknown> | null)?.total_score);
      return total === null ? null : { total_score: total };
    },
  },
];

/** sessionStorage keys owned by the parent (sans the `path:` prefix). */
export const KEYS = {
  painType: 'pain-classification:painType',
  role: 'pain-classification:role',
  /** Manual entry for a child is stored at `${manualPrefix}${slug}`. */
  manualPrefix: 'pain-classification:manual:',
  /** Optional per-child comment is stored at `${commentPrefix}${slug}`. */
  commentPrefix: 'pain-classification:comment:',
  /** Patient name / ID for the composite report. */
  patientName: 'pain-classification:patientName',
} as const;

export const RETURN_URL = '/pain-classification/acute/';
