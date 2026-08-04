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
 * Personalize a FreBAQ item by substituting the user's most bothersome body
 * region into the generic "the area" phrasing — so "the area feels lopsided"
 * reads "the right knee feels lopsided". The article and its capitalization
 * are preserved ("The area" at the start of a sentence keeps its capital), and
 * an empty area leaves the original wording untouched.
 */
export function personalizeFreBAQItem(label: string, area: string): string {
  const region = area.trim();
  if (!region) return label;
  return label.replace(/\b(the) area\b/gi, (_match, article) => `${article} ${region}`);
}
