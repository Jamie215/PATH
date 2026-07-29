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
