/**
 * Thin, type-safe wrapper around sessionStorage.
 *
 * All keys are prefixed with `path:` to avoid collisions with anything
 * else on the same origin. Reads/writes are JSON-encoded. All operations
 * are best-effort — failures (private browsing, quota exceeded, SSR)
 * return null/undefined rather than throwing so calling code stays simple.
 */

const PREFIX = 'path:';

/** Safe to call at module scope; SSR returns false. */
function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function set<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function get<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function remove(key: string): void {
  if (!hasStorage()) return;
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Clear every key managed by PATH; leaves other apps' storage untouched. */
export function clearAll(): void {
  if (!hasStorage()) return;
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) toDelete.push(k);
    }
    toDelete.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * The per-assessment storage keys (without the `path:` prefix), so every
 * reader and writer spells them the same way. `slug` is the assessment's
 * folder / URL name, e.g. `msi` or `frebaq`.
 */
export const keys = {
  /** The raw survey answers. */
  response: (slug: string) => `${slug}:response`,
  /** The scored result. */
  result: (slug: string) => `${slug}:result`,
  /** Patient name / ID typed on the results page. */
  patientName: (slug: string) => `${slug}:patientName`,
  /** Patient or professional, chosen at intake. */
  role: (slug: string) => `${slug}:role`,
} as const;
