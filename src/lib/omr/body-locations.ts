/**
 * Body-region vocabulary and a small, dependency-free fuzzy matcher used to
 * suggest the closest known body location for a scanned "most bothersome area"
 * entry (the FreBAQ preamble blank).
 *
 * This is deliberately an Elasticsearch-style *typo-tolerant match against a
 * closed vocabulary*, not a server search: everything runs on-device (the
 * patient's handwriting never leaves the browser), and the vocabulary is
 * small, so a length-scaled edit distance (à la ES `fuzziness: AUTO`) plus
 * token overlap fits this error model — the character substitutions and
 * transpositions that OCR of crossed-out / scribbled-over handwriting
 * produces — better than a heavier general search library would.
 *
 * It only ever *suggests*. Callers keep the reviewer's free text and offer
 * these as one-tap corrections; a location we don't recognize passes through
 * untouched (`matchBodyLocation` returns `[]`).
 */

interface BodyRegion {
  /** Canonical display name, without laterality (e.g. `lower back`). */
  canonical: string;
  /** Surface forms to match against — synonyms and the canonical itself,
   *  each already lowercase. Whichever scores best represents the region. */
  surfaces: string[];
  /** Whether a left/right/bilateral prefix is meaningful. Central regions
   *  (head, tailbone) drop a written side; most others keep it. */
  lateralized: boolean;
}

/** Curated musculoskeletal regions. Suggest-only, so coverage matters more
 *  than exhaustiveness: common synonyms are folded into `surfaces`. */
const BODY_REGIONS: readonly BodyRegion[] = [
  // Spine / back
  { canonical: 'neck', surfaces: ['neck', 'cervical'], lateralized: true },
  { canonical: 'upper back', surfaces: ['upper back', 'thoracic'], lateralized: true },
  { canonical: 'mid back', surfaces: ['mid back', 'middle back'], lateralized: true },
  { canonical: 'lower back', surfaces: ['lower back', 'low back', 'lumbar', 'lumbar spine'], lateralized: true },
  { canonical: 'tailbone', surfaces: ['tailbone', 'coccyx'], lateralized: false },
  { canonical: 'sacrum', surfaces: ['sacrum', 'sacral'], lateralized: false },
  // Head / face
  { canonical: 'head', surfaces: ['head'], lateralized: false },
  { canonical: 'jaw', surfaces: ['jaw', 'tmj'], lateralized: true },
  // Trunk
  { canonical: 'chest', surfaces: ['chest'], lateralized: true },
  { canonical: 'ribs', surfaces: ['ribs', 'rib', 'ribcage', 'rib cage'], lateralized: true },
  { canonical: 'abdomen', surfaces: ['abdomen', 'belly', 'stomach', 'tummy'], lateralized: false },
  { canonical: 'pelvis', surfaces: ['pelvis', 'pelvic'], lateralized: false },
  { canonical: 'groin', surfaces: ['groin'], lateralized: true },
  // Shoulder girdle / upper limb
  { canonical: 'shoulder', surfaces: ['shoulder'], lateralized: true },
  { canonical: 'shoulder blade', surfaces: ['shoulder blade', 'scapula'], lateralized: true },
  { canonical: 'collarbone', surfaces: ['collarbone', 'clavicle'], lateralized: true },
  { canonical: 'upper arm', surfaces: ['upper arm'], lateralized: true },
  { canonical: 'elbow', surfaces: ['elbow'], lateralized: true },
  { canonical: 'forearm', surfaces: ['forearm'], lateralized: true },
  { canonical: 'wrist', surfaces: ['wrist'], lateralized: true },
  { canonical: 'hand', surfaces: ['hand'], lateralized: true },
  { canonical: 'thumb', surfaces: ['thumb'], lateralized: true },
  { canonical: 'finger', surfaces: ['finger', 'fingers'], lateralized: true },
  // Pelvis / lower limb
  { canonical: 'hip', surfaces: ['hip'], lateralized: true },
  { canonical: 'buttock', surfaces: ['buttock', 'buttocks', 'glute', 'glutes', 'bum'], lateralized: true },
  { canonical: 'thigh', surfaces: ['thigh'], lateralized: true },
  { canonical: 'hamstring', surfaces: ['hamstring'], lateralized: true },
  { canonical: 'knee', surfaces: ['knee'], lateralized: true },
  { canonical: 'shin', surfaces: ['shin'], lateralized: true },
  { canonical: 'calf', surfaces: ['calf'], lateralized: true },
  { canonical: 'ankle', surfaces: ['ankle'], lateralized: true },
  { canonical: 'foot', surfaces: ['foot', 'feet'], lateralized: true },
  { canonical: 'heel', surfaces: ['heel'], lateralized: true },
  { canonical: 'toe', surfaces: ['toe', 'toes'], lateralized: true },
];

/** Laterality words, canonical side → accepted forms. Long forms tolerate a
 *  one-edit typo (`lefr` → left); the one/two-letter shorthands must match
 *  exactly so they don't swallow real body-part tokens. */
const SIDE_FORMS: readonly { side: string; forms: readonly string[] }[] = [
  { side: 'left', forms: ['left', 'lt', 'l'] },
  { side: 'right', forms: ['right', 'rt', 'r'] },
  { side: 'bilateral', forms: ['bilateral', 'bilat', 'both', 'either'] },
];

/** Region score below which we offer no suggestion — better a blank field
 *  (with the pinned crop to transcribe) than a confidently wrong guess. */
const SCORE_THRESHOLD = 0.5;

export interface BodyLocationMatch {
  /** Suggested label, laterality included where relevant (e.g. `left knee`). */
  label: string;
  /** Match confidence in [0, 1]; higher is closer. */
  score: number;
}

/** Lowercase, strip diacritics (so OCR's `kṇee` → `knee`), drop punctuation
 *  and scribble noise, and collapse whitespace. */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Optimal String Alignment distance (Damerau-Levenshtein restricted to
 *  adjacent transpositions) — enough for OCR errors, which are dominated by
 *  single substitutions and swapped neighbours. */
function osaDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i += 1) d[i][0] = i;
  for (let j = 0; j <= bl; j += 1) d[0][j] = j;
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/** Similarity in [0, 1] between two word tokens, with an ES-style
 *  length-scaled edit budget: short tokens tolerate no/one edit, longer ones
 *  up to two. Beyond the budget the tokens are treated as unrelated (0). */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const allowed = maxLen <= 2 ? 0 : maxLen <= 5 ? 1 : 2;
  const d = osaDistance(a, b);
  if (d > allowed) return 0;
  return 1 - d / maxLen;
}

/** Score a multi-word surface form against the query tokens: every surface
 *  token takes its best-matching query token, averaged over whichever side
 *  has more tokens so extra query words dilute the score. */
function phraseSimilarity(queryTokens: string[], surface: string): number {
  const surfaceTokens = surface.split(' ');
  let sum = 0;
  for (const st of surfaceTokens) {
    let best = 0;
    for (const qt of queryTokens) best = Math.max(best, tokenSimilarity(qt, st));
    sum += best;
  }
  return sum / Math.max(surfaceTokens.length, queryTokens.length);
}

/** Match a single token against the laterality words. */
function matchSide(token: string): string | null {
  for (const { side, forms } of SIDE_FORMS) {
    for (const f of forms) {
      if (token === f) return side;
      if (f.length >= 4 && tokenSimilarity(token, f) >= 0.75) return side;
    }
  }
  return null;
}

/** Pull the first laterality word out of the tokens, returning the canonical
 *  side (if any) and the remaining body-part tokens. */
function extractSide(tokens: string[]): { side: string | null; rest: string[] } {
  let side: string | null = null;
  const rest: string[] = [];
  for (const t of tokens) {
    if (side === null) {
      const matched = matchSide(t);
      if (matched) {
        side = matched;
        continue;
      }
    }
    rest.push(t);
  }
  return { side, rest };
}

/**
 * Suggest the closest known body locations for a raw (possibly OCR-garbled)
 * entry, best first. Returns up to `limit` distinct labels scoring above the
 * confidence threshold, or `[]` when nothing is close enough — in which case
 * the caller keeps the reviewer's free text as-is.
 */
export function matchBodyLocation(raw: string, limit = 3): BodyLocationMatch[] {
  const norm = normalize(raw);
  if (!norm) return [];
  const tokens = norm.split(' ');
  const { side, rest } = extractSide(tokens);
  // If only a side was written, fall back to matching the whole input.
  const queryTokens = rest.length ? rest : tokens;

  const scored: BodyLocationMatch[] = [];
  for (const region of BODY_REGIONS) {
    let best = 0;
    for (const surface of region.surfaces) {
      best = Math.max(best, phraseSimilarity(queryTokens, surface));
    }
    if (best < SCORE_THRESHOLD) continue;
    const label = side && region.lateralized ? `${side} ${region.canonical}` : region.canonical;
    scored.push({ label, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: BodyLocationMatch[] = [];
  for (const m of scored) {
    if (seen.has(m.label)) continue;
    seen.add(m.label);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}
