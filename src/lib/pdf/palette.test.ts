/**
 * pdf-lib can't read CSS, so the PDF report palette restates the site's design
 * tokens as rgb() values. This keeps each one equal to its token in
 * global.css, so changing a token without the PDF (or the reverse) fails here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as kit from './report-kit';

const css = readFileSync(join(__dirname, '../../styles/global.css'), 'utf8');

function token(name: string): [number, number, number] {
  const hex = css.match(new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`))?.[1];
  if (!hex) throw new Error(`No 6-digit hex token ${name} in global.css`);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** PDF colour constant → the global.css token it stands for. */
const PAIRS: [keyof typeof kit, string][] = [
  ['COLOR_PRIMARY', '--color-primary'],
  ['COLOR_PRIMARY_TINT', '--color-primary-tint'],
  ['COLOR_TEXT', '--color-text'],
  ['COLOR_MUTED', '--color-text-muted'],
  ['COLOR_BORDER', '--color-border'],
  ['COLOR_TINT', '--color-primary-tint-ghost'],
  ['COLOR_AMBER_BORDER', '--color-amber-700'],
  ['COLOR_AMBER_BG', '--color-amber-50'],
  ['COLOR_AMBER_PILL_BG', '--color-amber-200'],
  ['COLOR_AMBER_PILL_TEXT', '--color-amber-900'],
  ['COLOR_SUCCESS', '--color-success'],
  ['COLOR_DANGER', '--color-danger'],
  ['COLOR_WARNING', '--color-warning'],
];

describe('PDF palette matches the design tokens', () => {
  it.each(PAIRS)('%s = %s', (constant, name) => {
    const c = kit[constant] as unknown as { red: number; green: number; blue: number };
    const [r, g, b] = token(name);
    // rgb() values are written to 3 decimal places, so allow half a step of 255.
    expect(Math.abs(c.red - r)).toBeLessThan(0.003);
    expect(Math.abs(c.green - g)).toBeLessThan(0.003);
    expect(Math.abs(c.blue - b)).toBeLessThan(0.003);
  });
});
