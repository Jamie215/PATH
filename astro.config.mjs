import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

/**
 * Content-Security-Policy, emitted by Astro as a <meta> tag on every page with
 * hashes for its own inline scripts. The site loads everything from itself
 * except the handwriting model, downloaded from Hugging Face (see
 * src/lib/omr/handwriting.ts). Headers a <meta> CSP can't carry
 * (frame-ancestors etc.) are set in public/_headers.
 */
const HUGGING_FACE = [
  'https://huggingface.co',
  // Model downloads redirect to Hugging Face's storage/CDN hosts.
  'https://*.huggingface.co',
  'https://*.hf.co',
];

export default defineConfig({
  integrations: [svelte()],
  site: 'https://path.pages.dev',
  // Shiki's inline styles aren't CSP-compatible, and no page renders code.
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // data: — chart images and handwriting crops are read back via fetch().
        `connect-src 'self' data: blob: ${HUGGING_FACE.join(' ')}`,
        "img-src 'self' data: blob:",
        "font-src 'self'",
        // pdf.js runs in a worker; the uploaded PDF is previewed in a frame.
        "worker-src 'self' blob:",
        "frame-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        // The ONNX Runtime (handwriting) compiles WebAssembly and loads its
        // glue module from a blob: URL.
        resources: ["'self'", "'wasm-unsafe-eval'", 'blob:'],
      },
      styleDirective: {
        // Svelte `style:` directives (progress bars, bar widths) set inline
        // style attributes.
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },
});
