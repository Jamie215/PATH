/**
 * Composite scoring for the Pain Classification assessment.
 *
 * ⚠️ STUB — the acute weights / computation formula have not been wired in
 * yet. `scoreAcute` currently returns a placeholder so the end-to-end
 * workflow (intake → collect child results → Calculate Results → results
 * page) round-trips. Replace the body of `scoreAcute` once the weights land;
 * the input shape is already whatever the collection page gathers per child
 * (see `ACUTE_CHILDREN[].manualFields` / `fromResult` in ./config).
 */

/** Per-child inputs, keyed by child slug -> { fieldKey: value }. */
export type PainClassificationInputs = Record<string, Record<string, number>>;

export interface PainClassificationResult {
  /** Human-readable classification. Placeholder until weights are wired. */
  classification: string;
  /** Composite numeric score, once computable. */
  composite: number | null;
  /** Whether a real (weighted) result was produced. */
  ready: boolean;
  /** Echo of the inputs used, for display/debugging. */
  inputs: PainClassificationInputs;
}

export function scoreAcute(inputs: PainClassificationInputs): PainClassificationResult {
  // TODO: apply acute weights here.
  return {
    classification: 'Pending weight configuration',
    composite: null,
    ready: false,
    inputs,
  };
}
