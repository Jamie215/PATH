/**
 * Download a Material Symbols Outlined font containing only the icons listed in
 * scripts/icons.json, into public/fonts/. The site serves it itself, so pages
 * make no request to Google Fonts.
 *
 * Run after adding an icon to the UI (src/styles/icons.test.ts fails until you
 * do):   node scripts/fetch-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const icons = JSON.parse(readFileSync(new URL('scripts/icons.json', root), 'utf8'));
// Google requires the names sorted.
const names = [...new Set(icons)].sort();

const cssUrl =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0' +
  `&icon_names=${names.join(',')}&display=block`;
// A modern browser user agent, so Google serves woff2.
const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

const css = await (await fetch(cssUrl, { headers })).text();
const fontUrl = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error(`No woff2 URL in the Google Fonts response:\n${css}`);

const font = new Uint8Array(await (await fetch(fontUrl, { headers })).arrayBuffer());
writeFileSync(new URL('public/fonts/material-symbols-subset.woff2', root), font);
console.log(`Wrote ${names.length} icons (${(font.length / 1024).toFixed(1)} KB).`);
