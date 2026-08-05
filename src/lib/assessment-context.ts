/**
 * Parent-assessment context for composite flows.
 *
 * When a parent assessment (e.g. Pain Classification) launches a child
 * assessment (e.g. MSI), it writes a context entry to sessionStorage so
 * the child's results page can offer "Continue with [parent]" instead
 * of "Return to hub".
 *
 * Leaving an assessment's section clears all `path:` storage (see
 * session-clear.ts), so returning to the hub — or opening a different
 * assessment — naturally drops any stale parent context.
 */
import { get as storeGet, set as storeSet, remove as storeRemove } from './storage';

const KEY = 'assessment-context';

export interface AssessmentContext {
  parent: {
    slug: string;
    title: string;
    returnUrl: string;
  };
}

export function getAssessmentContext(): AssessmentContext | null {
  return storeGet<AssessmentContext>(KEY);
}

export function setAssessmentContext(ctx: AssessmentContext): void {
  storeSet(KEY, ctx);
}

export function clearAssessmentContext(): void {
  storeRemove(KEY);
}