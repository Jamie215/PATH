/**
 * Normalize a free-text "most bothersome area" entry before it is stored or
 * scored. Strips special characters — periods, commas, and any other
 * punctuation or symbols — keeping letters, numbers, and single spaces.
 *
 * Handwriting OCR (and hurried typing) often leaves stray punctuation on a
 * plain body-area phrase ("left knee.", "neck,"); this keeps the stored value
 * to words. Removed characters become a space so hyphenated or comma-separated
 * entries don't fuse ("mid-back" → "mid back", "left, hand" → "left hand").
 */
export function sanitizeBothersomeArea(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip a leading possessive/article ("my", "the") from a most-bothersome-area
 * entry, so a user who writes "my right hand" (or "the lower back") isn't left
 * with a doubled "my my right hand" once the questions prepend their own "my".
 * Only a leading whole word followed by more text is removed.
 */
export function stripLeadingArticle(area: string): string {
  return area.replace(/^\s*(?:my|the)\s+(?=\S)/i, '');
}

/**
 * Full normalization for a most-bothersome-area entry before it is confirmed,
 * stored, or woven into the questions: strip punctuation/symbols (via
 * {@link sanitizeBothersomeArea}) then drop a leading "my"/"the".
 */
export function normalizeBothersomeArea(text: string): string {
  return stripLeadingArticle(sanitizeBothersomeArea(text)).trim().toLowerCase();
}

/**
 * Best-effort guess of whether a most-bothersome-area entry is plural, so the
 * questions can agree in number ("my hands feel" vs "my knee feels").
 *
 * Heuristic, not a full pluralizer: a coordinated/"both" region is plural, a
 * handful of common irregular plurals are listed, and otherwise a trailing "s"
 * (but not "ss") is taken as plural. A few singular body terms that end in "s"
 * (e.g. "pelvis") are excepted. Rare irregular inputs may still be misjudged by
 * a single word — acceptable next to the generic default it replaces.
 */
const IRREGULAR_PLURALS = new Set(['feet', 'teeth', 'calves']);
const SINGULAR_ENDING_IN_S = new Set(['pelvis', 'iris']);

export function isPluralArea(area: string): boolean {
  // Detect on letters only, so trailing punctuation ("hands,") doesn't hide the
  // final "s".
  const text = area
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;
  if (/\b(?:both|and)\b/.test(text)) return true;
  const last = text.split(' ').pop() ?? '';
  if (IRREGULAR_PLURALS.has(last)) return true;
  if (SINGULAR_ENDING_IN_S.has(last)) return false;
  return last.length > 2 && /[^s]s$/.test(last);
}

/**
 * Personalize a FreBAQ item template by expanding its placeholders (see the
 * token legend on QUESTIONS): the bothersome region is woven in as "my right
 * knee" (capitalized "My right knee" at the start of a sentence), and the
 * number-sensitive pairs agree with whether that region reads as plural. A
 * leading "my"/"the" the user typed is stripped so it isn't doubled, and an
 * empty area falls back to the generic "the area"/"The area", singular.
 */
export function personalizeFreBAQItem(label: string, area: string): string {
  // Lowercase the region so a "Right Knee" entry reads "my right knee" (the
  // sentence-initial "My" comes from the {Area} token, not the region).
  const region = stripLeadingArticle(area.trim()).trim().toLowerCase();
  const plural = isPluralArea(region);
  return label.replace(/\{([^{}]+)\}/g, (_match, token: string) => {
    if (token === 'Area') return region ? `My ${region}` : 'The area';
    if (token === 'area') return region ? `my ${region}` : 'the area';
    const pipe = token.indexOf('|');
    if (pipe !== -1) return plural ? token.slice(pipe + 1) : token.slice(0, pipe);
    return token; // unknown token: emit its inner text unchanged
  });
}
