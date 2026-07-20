/**
 * Composite scoring for the acute Pain Classification pathway.
 *
 * Ported from the "more stable model" transformation workbook:
 *
 *   1. Each raw sub-score is standardised to a Z-score. Every transformation
 *      table in the workbook is exactly linear, so each is stored here as
 *      (min, max, zMin, zMax) and interpolated — this reproduces the
 *      workbook's VLOOKUP for in-range integer inputs, and clamps anything
 *      out of range.
 *   2. Five Z-scores feed four category linear discriminants (the multinomial
 *      logistic coefficients from the workbook). TIDS and Brief PCS appear in
 *      the workbook but are not used by the model, so they are omitted.
 *   3. A softmax over the four discriminants gives posterior probabilities;
 *      the highest-scoring category is the predicted class.
 *
 * Model inputs and the raw domains the model was calibrated on:
 *   - MSI Somatic   0–60  (msi.somatic)
 *   - MSI Central   0–72  (msi.nonsomatic)
 *   - Brief SLANSS  0–4   (briefslanss.total_score)
 *   - FreBAQ        0–24  (frebaq.total_score)
 *   - PHQ-4         0–12  (phq4.total_score)
 */

export const CATEGORIES = [
  'Mood-Dominant',
  'Localized/Resilient',
  'Central/Complex',
  'Neurosensory-Dominant',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Measure = 'somatic' | 'central' | 'slanss' | 'frebaq' | 'phq4';

/** Per-measure linear standardisation, read off the workbook's transform tables. */
interface ZSpec {
  min: number;
  max: number;
  zMin: number;
  zMax: number;
}

const Z_SPECS: Record<Measure, ZSpec> = {
  somatic: { min: 0, max: 60, zMin: -2.00415, zMax: 2.55216 },
  central: { min: 0, max: 72, zMin: -1.18272, zMax: 3.32006 },
  slanss: { min: 0, max: 4, zMin: -1.35666, zMax: 1.79376 },
  frebaq: { min: 0, max: 24, zMin: -0.99064, zMax: 3.05668 },
  phq4: { min: 0, max: 12, zMin: -1.20701, zMax: 1.87713 },
};

function toZ(raw: number, s: ZSpec): number {
  const clamped = Math.min(s.max, Math.max(s.min, raw));
  return s.zMin + ((clamped - s.min) * (s.zMax - s.zMin)) / (s.max - s.min);
}

/**
 * Discriminant coefficients, one row per category:
 * [intercept, somatic, central, slanss, frebaq, phq4].
 */
const COEFFS: Record<Category, [number, number, number, number, number, number]> = {
  'Mood-Dominant': [1.8276, 0.000856, 0.0, -0.9105, -1.7185, 2.6417],
  'Localized/Resilient': [3.2222, -0.3861, -2.3383, -0.3207, -2.0971, -5.7957],
  'Central/Complex': [-6.2004, 0.4973, 1.8317, 0.3153, 1.5179, 5.1043],
  'Neurosensory-Dominant': [1.1506, -0.1121, 0.3054, 0.9159, 2.2977, -1.9504],
};

/** Per-child inputs, keyed by child slug -> { fieldKey: value }. */
export type PainClassificationInputs = Record<string, Record<string, number>>;

export interface PainClassificationResult {
  ready: boolean;
  /** Predicted category (argmax of the discriminants). */
  classification: Category;
  /** Raw linear discriminant score per category. */
  scores: Record<Category, number>;
  /** Softmax posterior probability per category (0–1, sums to 1). */
  probabilities: Record<Category, number>;
  /** Standardised (Z) value used for each measure. */
  z: Record<Measure, number>;
  /** Echo of the inputs used. */
  inputs: PainClassificationInputs;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function scoreAcute(inputs: PainClassificationInputs): PainClassificationResult {
  const z: Record<Measure, number> = {
    somatic: toZ(num(inputs.msi?.somatic), Z_SPECS.somatic),
    central: toZ(num(inputs.msi?.nonsomatic), Z_SPECS.central),
    slanss: toZ(num(inputs.briefslanss?.total_score), Z_SPECS.slanss),
    frebaq: toZ(num(inputs.frebaq?.total_score), Z_SPECS.frebaq),
    phq4: toZ(num(inputs.phq4?.total_score), Z_SPECS.phq4),
  };

  // [1, z...] lines up with [intercept, coeff...].
  const vec = [1, z.somatic, z.central, z.slanss, z.frebaq, z.phq4];

  const scores = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    scores[cat] = COEFFS[cat].reduce((sum, c, i) => sum + c * vec[i], 0);
  }

  // Softmax, shifted by the max for numerical stability (as the workbook does).
  const maxScore = Math.max(...CATEGORIES.map((c) => scores[c]));
  const exps = CATEGORIES.map((c) => Math.exp(scores[c] - maxScore));
  const denom = exps.reduce((a, b) => a + b, 0);
  const probabilities = {} as Record<Category, number>;
  CATEGORIES.forEach((c, i) => {
    probabilities[c] = exps[i] / denom;
  });

  let classification: Category = CATEGORIES[0];
  for (const c of CATEGORIES) {
    if (scores[c] > scores[classification]) classification = c;
  }

  return { ready: true, classification, scores, probabilities, z, inputs };
}
