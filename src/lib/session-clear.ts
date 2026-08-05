/**
 * Patient-data hygiene for shared clinical devices.
 *
 * All assessment data (names, responses, results) lives in sessionStorage
 * under the `path:` prefix and is scoped to a single browser tab. This module
 * adds a stronger guarantee *within* a tab's lifetime: patient data is wiped
 * as soon as the user leaves the assessment they were in.
 *
 * The rule is destination-based, not event-based:
 *
 *   Leaving an assessment's URL section clears its data; navigating within
 *   the same section keeps it.
 *
 * Each assessment is a URL section identified by its first path segment
 * (`/msi/...`, `/pain-classification/...`); the hub home (`/`) is the empty
 * section. Because the check runs on page load and compares the section we
 * arrived at against the one we came from, it treats every navigation type
 * uniformly:
 *
 *   - survey -> results (same section)            -> kept
 *   - Back to a previous step (same section)      -> kept  (editing)
 *   - reload (same section)                       -> kept
 *   - results -> Home, or Back out to the hub     -> cleared
 *   - abandon one assessment, open another        -> cleared
 *
 * Closing the tab is already handled by sessionStorage itself.
 *
 * A second, explicit trigger: any element marked `data-clear-session` (e.g.
 * "Redo Assessment") clears on click, so restarting the *same* assessment
 * begins a fresh encounter even though it stays in-section.
 */
import { clearAll } from './storage';

/**
 * Tracks the section of the last page load. Deliberately un-prefixed so
 * `clearAll()` (which only removes `path:` keys) leaves it intact — it holds a
 * route segment, never patient data.
 */
const NAV_KEY = 'nav:section';

/** First path segment identifies the assessment; '' is the hub home. */
export function sectionOf(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? '';
}

export function initSessionClear(): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;

  // Section-transition clear: wipe the section we just left.
  try {
    const current = sectionOf(window.location.pathname);
    const previous = window.sessionStorage.getItem(NAV_KEY);
    if (previous !== null && previous !== current) {
      clearAll();
    }
    window.sessionStorage.setItem(NAV_KEY, current);
  } catch {
    /* best-effort; private browsing / SSR fall through harmlessly */
  }

  // Explicit clear for in-section restarts (e.g. "Redo Assessment").
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-clear-session]')) {
      clearAll();
    }
  });
}
