/**
 * Copy the ONNX Runtime WebAssembly files that transformers.js loads (for the
 * handwriting model) from node_modules into public/ort/, so the site serves
 * them itself instead of transformers.js fetching them from jsDelivr. Run
 * automatically before `dev` and `build` (see package.json); public/ort/ is
 * git-ignored because it is regenerated from the installed package.
 */
import { copyFileSync, mkdirSync } from 'node:fs';

const FILES = [
  // Default (asyncify) build, and the plain build transformers.js picks on Safari.
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

const src = new URL('../node_modules/onnxruntime-web/dist/', import.meta.url);
const dest = new URL('../public/ort/', import.meta.url);
mkdirSync(dest, { recursive: true });
for (const f of FILES) copyFileSync(new URL(f, src), new URL(f, dest));
console.log(`Copied ${FILES.length} ONNX Runtime files to public/ort/.`);
