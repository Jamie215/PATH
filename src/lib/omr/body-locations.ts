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

/**
 * Digit vocabulary: which finger/toe a token names. `finger` / `toe` give the
 * qualifier to use once the region is known (so `middle` becomes "middle
 * finger" but is dropped for a toe, and `second` the reverse). `soloFinger`
 * marks the unambiguously-finger names that imply a finger even when the word
 * "finger" is omitted (e.g. bare `thumb`, `index`).
 *
 * Scope is deliberately bounded to digit *identity*: segments (tip, base,
 * knuckle) and ambiguous finger ordinals (is "first finger" the thumb?) are
 * not modelled — when present they dilute the match below the auto-fill bar,
 * so the raw text is kept for the reviewer instead.
 */
interface DigitForm {
  forms: readonly string[];
  /** Qualifier when the region is a finger, e.g. `index` → "index finger". */
  finger?: string;
  /** Qualifier when the region is a toe, e.g. `big` → "big toe". */
  toe?: string;
  /** Implies a finger on its own (bare `thumb` → "thumb"). */
  soloFinger?: boolean;
}

const DIGITS: readonly DigitForm[] = [
  { forms: ['thumb'], finger: 'thumb', soloFinger: true },
  { forms: ['index', 'pointer', 'forefinger'], finger: 'index', soloFinger: true },
  { forms: ['middle'], finger: 'middle' },
  { forms: ['ring'], finger: 'ring', soloFinger: true },
  { forms: ['little', 'pinky', 'pinkie'], finger: 'little', toe: 'little' },
  { forms: ['big', 'great'], toe: 'big' },
  { forms: ['second', '2nd'], toe: 'second' },
  { forms: ['third', '3rd'], toe: 'third' },
  { forms: ['fourth', '4th'], toe: 'fourth' },
  { forms: ['small'], toe: 'little' },
  { forms: ['fifth', '5th'], toe: 'little' },
];

/** Region canonicals that accept a digit qualifier. */
const DIGIT_REGIONS = new Set(['finger', 'toe']);

/** Filler words stripped before parsing, so "tip of the index finger" and
 *  "left side of neck" reduce to their meaningful tokens. Kept small: only
 *  words that never name a body part in the vocabulary. */
const STOPWORDS = new Set(['of', 'on', 'the', 'my', 'a', 'an', 'at', 'in', 'side', 'area', 'part', 'region']);

/** Region score below which we offer no suggestion at all — better to keep
 *  the raw text (with the pinned crop to read) than a wrong guess. */
const SCORE_THRESHOLD = 0.5;

/** Higher bar for *auto-filling* the field: a clean read (exact term, or a
 *  single typo in a word of ~4+ letters) replaces the OCR text; anything less
 *  certain is left as raw text for the reviewer to correct against the crop. */
export const AUTOFILL_MIN_SCORE = 0.75;

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

/** Copy of `tokens` with the first occurrence of `token` removed. */
function removeFirst(tokens: string[], token: string): string[] {
  const i = tokens.indexOf(token);
  return i === -1 ? tokens.slice() : [...tokens.slice(0, i), ...tokens.slice(i + 1)];
}

/** The region whose canonical name is `name`. */
function regionByCanonical(name: string): BodyRegion | undefined {
  return BODY_REGIONS.find((r) => r.canonical === name);
}

/** Score every region against the query tokens (best surface per region),
 *  keeping those above the suggestion floor, best first. */
function rankRegions(queryTokens: string[]): { region: BodyRegion; score: number }[] {
  const scored: { region: BodyRegion; score: number }[] = [];
  for (const region of BODY_REGIONS) {
    let best = 0;
    for (const surface of region.surfaces) {
      best = Math.max(best, phraseSimilarity(queryTokens, surface));
    }
    if (best >= SCORE_THRESHOLD) scored.push({ region, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Find the first token naming a finger/toe, with its digit entry so the
 *  qualifier can be resolved once the region is known. */
function findDigit(tokens: string[]): { token: string; entry: DigitForm } | null {
  for (const token of tokens) {
    for (const entry of DIGITS) {
      for (const f of entry.forms) {
        if (token === f || (f.length >= 4 && tokenSimilarity(token, f) >= 0.8)) {
          return { token, entry };
        }
      }
    }
  }
  return null;
}

/** Build a display label from side + optional digit qualifier + region
 *  (e.g. `left` + `index` + `finger` → "left index finger"; `thumb` alone). */
function composeLabel(side: string | null, region: BodyRegion, qualifier: string | null): string {
  const core =
    qualifier === 'thumb' ? 'thumb' : qualifier ? `${qualifier} ${region.canonical}` : region.canonical;
  return side && region.lateralized ? `${side} ${core}` : core;
}

/**
 * Suggest the closest known body locations for a raw (possibly OCR-garbled)
 * entry, best first. Understands a laterality prefix (left/right) and a
 * finger/toe digit (index, middle, big toe, …); segments and other deep
 * positional language are not modelled and simply lower the score. Returns up
 * to `limit` distinct labels above the confidence threshold, or `[]` when
 * nothing is close enough — in which case the caller keeps the free text.
 */
export function matchBodyLocation(raw: string, limit = 3): BodyLocationMatch[] {
  const norm = normalize(raw);
  if (!norm) return [];
  const tokens = norm.split(' ').filter((t) => !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const { side, rest } = extractSide(tokens);
  // If only a side was written, fall back to matching the whole input.
  const queryTokens = rest.length ? rest : tokens;

  const candidates: BodyLocationMatch[] = [];

  // Digit facet: if a finger/toe name is present, reveal the region from the
  // remaining tokens. Region-gated, so a digit word that also reads as a
  // region ("middle" ↔ mid back) only counts when a finger/toe is left over.
  const digit = findDigit(queryTokens);
  if (digit) {
    const revealed = rankRegions(removeFirst(queryTokens, digit.token))[0];
    let region: BodyRegion | undefined;
    let score = 0;
    if (revealed && DIGIT_REGIONS.has(revealed.region.canonical)) {
      region = revealed.region;
      score = revealed.score;
    } else if (queryTokens.length === 1 && digit.entry.soloFinger) {
      // Bare "thumb" / "index" with no "finger" written — imply a finger.
      region = regionByCanonical('finger');
      score = 0.85;
    }
    if (region) {
      const qualifier = region.canonical === 'finger' ? digit.entry.finger : digit.entry.toe;
      if (qualifier) candidates.push({ label: composeLabel(side, region, qualifier), score });
    }
  }

  // Plain region matches (no digit qualifier).
  for (const { region, score } of rankRegions(queryTokens)) {
    candidates.push({ label: composeLabel(side, region, null), score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: BodyLocationMatch[] = [];
  for (const m of candidates) {
    if (seen.has(m.label)) continue;
    seen.add(m.label);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The single best body-location label for a raw entry, but only when the match
 * is confident enough to replace the text automatically (see
 * `AUTOFILL_MIN_SCORE`). Returns `null` for a low-confidence or absent match,
 * so the caller keeps the raw OCR text for the reviewer to verify against the
 * pinned crop.
 */
export function autofillBodyLocation(raw: string): string | null {
  const [best] = matchBodyLocation(raw, 1);
  return best && best.score >= AUTOFILL_MIN_SCORE ? best.label : null;
}
