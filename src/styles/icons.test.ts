/**
 * The self-hosted icon font only contains the icons in scripts/icons.json. An
 * icon used in the UI but missing from that list renders as its name ("close")
 * instead of a glyph, so this scans the source for every icon name in use.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const listed = new Set<string>(
  JSON.parse(readFileSync(join(__dirname, '../../scripts/icons.json'), 'utf8')),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__fixtures__' ? [] : sourceFiles(path);
    return /\.(svelte|astro|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Icon names referenced in one file. */
function iconsIn(text: string): string[] {
  const found: string[] = [];
  // Content of every icon span: a literal name, or quoted names in an expression.
  for (const m of text.matchAll(/class="[^"]*material-symbols-outlined[^"]*"[^>]*>([\s\S]*?)<\/span>/g)) {
    const body = m[1].trim();
    if (/^[a-z_]+$/.test(body)) found.push(body);
    else for (const q of body.matchAll(/'([a-z_]+)'/g)) found.push(q[1]);
  }
  // Icons passed as data: the hub registry's `icon: '…'` and `submitIcon` values.
  for (const m of text.matchAll(/\bicon: '([a-z_]+)'/g)) found.push(m[1]);
  for (const line of text.split('\n').filter((l) => /submitIcon\s*=/.test(l))) {
    for (const q of line.matchAll(/'([a-z_]+)'/g)) found.push(q[1]);
  }
  return found;
}

describe('self-hosted icon subset', () => {
  const used = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    for (const icon of iconsIn(readFileSync(file, 'utf8'))) used.set(icon, file);
  }

  it('finds the icons in use', () => {
    expect(used.size).toBeGreaterThan(10);
  });

  it('includes every icon the UI uses (else run: node scripts/fetch-icons.mjs)', () => {
    const missing = [...used].filter(([icon]) => !listed.has(icon)).map(([i, f]) => `${i} (${f})`);
    expect(missing).toEqual([]);
  });
});
