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
  return stripLeadingArticle(sanitizeBothersomeArea(text)).trim();
}

/**
 * Personalize a FreBAQ item by substituting the user's most bothersome body
 * region into the generic "the area" phrasing — so "the area feels lopsided"
 * reads "my right knee feels lopsided". The article's capitalization is
 * preserved as a possessive ("The area" at the start of a sentence → "My right
 * knee"), a leading "my"/"the" on the region is stripped so it isn't doubled,
 * and an empty area leaves the original wording untouched.
 */
export function personalizeFreBAQItem(label: string, area: string): string {
  const region = stripLeadingArticle(area.trim()).trim();
  if (!region) return label;
  return label.replace(
    /\b(the) area\b/gi,
    (_match, article) => `${article[0] === 'T' ? 'My' : 'my'} ${region}`,
  );
}
