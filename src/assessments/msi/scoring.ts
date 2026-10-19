/**
 * MSI (Multi-Dimensional Symptom Index) scoring.
 *
 * Direct port of the original Python `MSI.analyze()` from msi.py.
 * Preserves all behavior exactly, including the dual-counting of `numb`
 * (it appears in both the somatic and non-somatic symptom lists, which
 * is why max somatic = 60 and max nonsomatic = 72 despite there being
 * only 10 unique symptoms).
 */
import { MATRIX } from './matrix';

// --- Constants ---------------------------------------------------------------

export const SYMPTOMS = [
  'sharp', 'dull', 'stiff', 'weak', 'sensitive',
  'numb', 'fatigue', 'foggy', 'nausea', 'anxiety',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

/** Column index into MATRIX for each symptom. */
const SYMPTOM_INDEX: Record<Symptom, number> = {
  sharp: 0, dull: 1, stiff: 2, weak: 3, sensitive: 4,
  numb: 5, fatigue: 6, foggy: 7, nausea: 8, anxiety: 9,
};

/** Human-readable labels matched 1:1 with msi.py's label_index. */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  sharp: 'Sharp or shooting pain',
  dull: 'General dull achiness',
  stiff: 'Stiffness or restricted movement',
  weak: 'Weakness, clumsiness, or giving way',
  sensitive: 'Increased sensitivity',
  numb: 'Numbness or pins & needles',
  fatigue: 'Fatigue',
  foggy: 'Fogginess',
  nausea: 'Poor appetite or nausea',
  anxiety: 'Nervousness, anxiety or sadness',
};

/**
 * Maximum of each summary measure. `numb` counts toward both somatic and
 * non-somatic, hence 60 + 72 from ten symptoms.
 */
export const MAX = {
  symp_no: 10,
  freq_mean: 3,
  int_mean: 4,
  somatic: 60,
  nonsomatic: 72,
} as const;

/**
 * Change needed on each summary measure for a clinically meaningful
 * improvement — the "target score" is the current value minus this, floored at
 * zero. Values match the original PythonAnywhere template.
 */
export const MEANINGFUL_CHANGE = {
  symp_no: 1.8,
  freq_mean: 0.9,
  int_mean: 1.0,
  somatic: 7.5,
  nonsomatic: 6.1,
} as const;

export type SummaryMeasure = keyof typeof MAX;

/** The summary-score table, in display order (results view and PDF). */
export const SUMMARY_MEASURES: ReadonlyArray<{
  key: SummaryMeasure;
  label: string;
  /** Decimal places when displayed (counts/totals are integers, means are 1dp). */
  decimals: 0 | 1;
}> = [
  { key: 'symp_no', label: 'Number of symptoms', decimals: 0 },
  { key: 'freq_mean', label: 'Mean frequency', decimals: 1 },
  { key: 'int_mean', label: 'Mean bothersomeness', decimals: 1 },
  { key: 'somatic', label: 'Somatic symptoms', decimals: 0 },
  { key: 'nonsomatic', label: 'Non-somatic symptoms', decimals: 0 },
];

/** Target score for meaningful change (never negative). */
export function targetScore(result: MSIResult, key: SummaryMeasure): number {
  return Math.max(0, result[key] - MEANINGFUL_CHANGE[key]);
}

/** Screening cutoffs on the non-somatic total (match msi.py exactly). */
export const SCREENING_CUTOFFS = {
  /** Full recovery Likely at or below `likelyMax`, Unlikely at or above `unlikelyMin`. */
  fullRecovery: { likelyMax: 2, unlikelyMin: 22 },
  /** MDD Unlikely at or below `unlikelyMax`, Likely at or above `likelyMin`. */
  mdd: { unlikelyMax: 9, likelyMin: 21 },
} as const;

const SOMATIC: ReadonlySet<Symptom> = new Set(['sharp', 'dull', 'stiff', 'weak', 'numb']);
const NONSOMATIC: ReadonlySet<Symptom> = new Set([
  'sensitive', 'numb', 'fatigue', 'foggy', 'nausea', 'anxiety',
]);

// --- Types -------------------------------------------------------------------

/** Frequency rating: 0=Never, 1=Rarely, 2=Often, 3=Always. */
export type Frequency = 0 | 1 | 2 | 3;

/** Interference (bothersomeness) rating: 1=Barely, 2=Noticeable, 3=Quite, 4=Stop. */
export type Interference = 1 | 2 | 3 | 4;

/**
 * Shape of the survey response object as posted from the form.
 * For each symptom: `<symptom>_freq` is always present (required).
 * `<symptom>_interference` is present only if freq > 0.
 */
export type MSIResponse = {
  [K in `${Symptom}_freq`]: Frequency;
} & {
  [K in `${Symptom}_interference`]?: Interference;
} & {
  other_comments?: string;
};

/**
 * Result shape — identical keys to the original Python return dict so it
 * remains a drop-in replacement for the existing templates.
 */
export interface MSIResult {
  somatic: number;
  nonsomatic: number;
  labels: string[];
  vals: number[];
  symp_no: number;
  freq_mean: number;
  int_mean: number;
  full_rec: 'Likely' | 'Unlikely' | 'Unclear';
  mdd: 'Likely' | 'Unlikely' | 'Unclear';
  comments: string;
}

// --- Core scoring ------------------------------------------------------------

/**
 * Map (frequency, interference) to the matrix row index used in matrix.csv.
 * - freq=0 (Never)        → row 0  (interference irrelevant)
 * - freq=1 (Rarely) + int  → rows 1..4
 * - freq=2 (Often) + int   → rows 5..8
 * - freq=3 (Always) + int  → rows 9..12
 *
 * Equivalent to (freq - 1) * 4 + interference when freq > 0.
 */
function matrixRow(freq: Frequency, interference?: Interference): number {
  if (freq === 0) return 0;
  if (interference === undefined) {
    throw new Error(
      `Interference rating is required when frequency > 0 (got freq=${freq})`,
    );
  }
  return (freq - 1) * 4 + interference;
}

/** Look up the score for a single (symptom, freq, interference) triple. */
function symptomScore(
  symptom: Symptom,
  freq: Frequency,
  interference?: Interference,
): number {
  const row = matrixRow(freq, interference);
  return MATRIX[row][SYMPTOM_INDEX[symptom]];
}

/**
 * Score an MSI survey response and return summary metrics + per-symptom values.
 * Behaviorally identical to the Python `MSI.analyze()`.
 */
export function score(response: MSIResponse): MSIResult {
  const labels: string[] = [];
  const vals: number[] = [];

  let somatic = 0;
  let nonsomatic = 0;
  let symptomsCount = 0;
  let freqSum = 0;
  let interferenceSum = 0;
  let interferenceCount = 0;

  for (const symptom of SYMPTOMS) {
    const freq = (response[`${symptom}_freq`] ?? 0) as Frequency;
    const interference = response[`${symptom}_interference`] as Interference | undefined;

    if (freq !== 0) {
      symptomsCount += 1;
      if (interference !== undefined) {
        interferenceSum += interference;
        interferenceCount += 1;
      }
    }
    freqSum += freq;

    const value = symptomScore(symptom, freq, interference);
    labels.push(SYMPTOM_LABELS[symptom]);
    vals.push(value);

    if (SOMATIC.has(symptom)) somatic += value;
    if (NONSOMATIC.has(symptom)) nonsomatic += value;
  }

  const { fullRecovery: fr, mdd: md } = SCREENING_CUTOFFS;
  const full_rec: MSIResult['full_rec'] =
    nonsomatic <= fr.likelyMax ? 'Likely' : nonsomatic >= fr.unlikelyMin ? 'Unlikely' : 'Unclear';
  const mdd: MSIResult['mdd'] =
    nonsomatic <= md.unlikelyMax ? 'Unlikely' : nonsomatic >= md.likelyMin ? 'Likely' : 'Unclear';

  const comments =
    typeof response.other_comments === 'string' && response.other_comments.length > 0
      ? response.other_comments
      : 'No comment provided.';

  // frequency_no in the Python is always 10 (one freq per symptom)
  const freq_mean = freqSum / SYMPTOMS.length;
  const int_mean = interferenceCount > 0 ? interferenceSum / interferenceCount : 0;

  return {
    somatic,
    nonsomatic,
    labels,
    vals,
    symp_no: symptomsCount,
    freq_mean,
    int_mean,
    full_rec,
    mdd,
    comments,
  };
}
