/**
 * Parent-assessment context for composite flows.
 *
 * When a parent assessment (e.g. Pain Classification) launches a child
 * assessment (e.g. MSI), it writes a context entry to sessionStorage so
 * the child's results page can offer "Continue with [parent]" instead
 * of "Return to hub".
 *
 * The hub home (/) clears this on visit, so direct entry to a child
 * assessment from the hub naturally has no parent context.
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