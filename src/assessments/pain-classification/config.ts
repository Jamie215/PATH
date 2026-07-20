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
 * the (forthcoming) scoring module, so wiring a child differently — or
 * adjusting the manual-entry fields once the acute weights are finalized —
 * is a one-place change.
 */

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
   * Manual-entry fields. PROVISIONAL: these mirror the primary numbers each
   * child produces today; revisit once the acute weights pin down exactly
   * which inputs the composite consumes.
   */
  manualFields: ManualField[];
  /**
   * Pull the manual-field values out of a stored child result, so a child
   * completed via questionnaire feeds the composite the same shape as a
   * manual entry. Returns null if the stored result is missing/unusable.
   */
  fromResult: (result: unknown) => Record<string, number> | null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Child assessments composing the ACUTE pain-classification pathway. */
export const ACUTE_CHILDREN: ChildAssessment[] = [
  {
    slug: 'msi',
    title: 'Multi-Dimensional Symptom Index',
    shortName: 'MSI',
    resultKey: 'msi:result',
    surveyUrl: '/msi/survey/',
    roleKey: 'msi:role',
    manualFields: [
      { key: 'somatic', label: 'Somatic score', min: 0, max: 100 },
      { key: 'nonsomatic', label: 'Non-somatic score', min: 0, max: 100 },
      { key: 'symp_no', label: 'Number of symptoms', min: 0, max: 10 },
    ],
    fromResult: (r) => {
      const o = r as Record<string, unknown> | null;
      if (!o) return null;
      const somatic = num(o.somatic);
      const nonsomatic = num(o.nonsomatic);
      const symp_no = num(o.symp_no);
      if (somatic === null || nonsomatic === null || symp_no === null) return null;
      return { somatic, nonsomatic, symp_no };
    },
  },
  {
    slug: 'briefslanss',
    title: 'LANSS Screening (Brief)',
    shortName: 'BriefSLANSS',
    resultKey: 'briefslanss:result',
    surveyUrl: '/briefslanss/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 24 }],
    fromResult: (r) => {
      const total = num((r as Record<string, unknown> | null)?.total_score);
      return total === null ? null : { total_score: total };
    },
  },
  {
    slug: 'frebaq',
    title: 'Fremantle Back Awareness Questionnaire',
    shortName: 'FreBAQ',
    resultKey: 'frebaq:result',
    surveyUrl: '/frebaq/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 36 }],
    fromResult: (r) => {
      const total = num((r as Record<string, unknown> | null)?.total_score);
      return total === null ? null : { total_score: total };
    },
  },
  {
    slug: 'phq4',
    title: 'Patient Health Questionnaire-4',
    shortName: 'PHQ-4',
    resultKey: 'phq4:result',
    surveyUrl: '/phq4/',
    manualFields: [{ key: 'total_score', label: 'Total score', min: 0, max: 12 }],
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
} as const;

export const RETURN_URL = '/pain-classification/acute/';
