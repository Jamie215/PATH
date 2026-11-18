# CLAUDE.md

PATH (Pain Assessment Tools Hub): a static Astro + Svelte site of validated pain
and symptom questionnaires (MSI, FreBAQ, Brief S-LANSS, PHQ-4, Pain
Classification). It is deployed to Cloudflare Pages. All scoring runs in the
browser. See README.md for the full picture.

## Layout

- `src/assessments/<tool>/`: `questions.ts`, `scoring.ts`, `omr-template.ts` for each assessment
- `src/assessments/registry.ts`: cards on the hub home
- `src/assessments/pain-classification/`: the composite (child wiring in `config.ts`)
- `src/components/`: Svelte UI (shared `survey/`, `results/`; composite pages in `pain-classification/`)
- `src/lib/`: storage, session clearing, PDF reports (`pdf/report-kit.ts`), charts, `omr/` (reading uploaded sheets)
- `src/pages/`: file-based routes
- `src/styles/global.css`: design tokens
- `scripts/`: `copy-ort.mjs` (runs before dev/build), `fetch-icons.mjs` + `icons.json`

## Commands

Use Node 22 (`.nvmrc`; needs 22.13 or later).

```bash
npm ci
npm run dev                                  # http://localhost:4321
npm run check && npm test && npm run build   # must all pass before a change is done (same as CI)
```

## Rules

- **Patient data never leaves the browser.** Names, responses and results live
  only in `sessionStorage` under the `path:` prefix (`src/lib/storage.ts`). They are
  wiped by `src/lib/session-clear.ts`. Add no network calls, analytics, logging
  services or persistent storage for patient data.
- **One outside host:** Hugging Face, for the handwriting model only. The CSP is
  `security.csp` in `astro.config.mjs` (`HUGGING_FACE` list), and other headers
  are in `public/_headers`. Don't loosen either. Serve every other asset locally.
  Change `MODEL_REVISION` (`src/lib/omr/handwriting.ts`) only when asked, and
  re-check recognition after.
- **Clinical constants** (maximum scores, cutoffs, bands) live only in each
  assessment's `scoring.ts`. Views, PDFs and the composite import them from there.
  Never duplicate them, and never change a threshold unless asked: some still need
  confirmation from the PI.
- **Colors** come from the CSS variables in `global.css`. Don't hard-code colors in components.
- **New icon:** add its name to `scripts/icons.json` and run
  `node scripts/fetch-icons.mjs`. A test fails until you do.
- **Deploys:** pushing to `main` deploys to production. Never push to `main`;
  work on a branch.
- **Docs** are Markdown only. Don't add `.docx` or other generated copies.
