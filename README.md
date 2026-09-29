# PATH

**Pain Assessment Tools Hub** — a central hub for validated pain and
symptom assessment tools.

PATH is a static site built with [Astro](https://astro.build) and
[Svelte](https://svelte.dev), deployed to [Cloudflare Pages](https://pages.cloudflare.com).
All scoring runs client-side; no patient data leaves the browser.

## Status

All current assessments are implemented and score client-side. The
Sensory Profile and Anxiety & Depression screens are reached as steps
within the Pain Classification composite rather than as standalone hub
cards.

| Assessment | Status |
|---|---|
| Symptom Index (MSI) | Available |
| Body Awareness (FreBAQ) | Available |
| Sensory Profile (briefSLANSS) | Available (within Pain Classification) |
| Anxiety & Depression (PHQ-4) | Available (within Pain Classification) |
| Pain Classification Assessment | Available |

## Getting started

Prerequisites: Node.js 22.13+ (see `.nvmrc`; required by Astro 7 and
pdf.js 6) and npm.

```bash
npm install
npm run dev      # dev server at http://localhost:4321
npm test         # unit tests (vitest)
npm run check    # type-check .astro (astro check) and .svelte (svelte-check)
npm run build    # static build into dist/
```

CI (`.github/workflows/ci.yml`) runs `check`, `test` and `build` on every
pull request and on `main`.

## Project structure

```
src/
  assessments/        Per-assessment questions, scoring, OMR sheet templates
    registry.ts       Cards shown on the hub home
    screening.ts      Shared shape of the single-total screeners
    screener-reports.ts  Report copy for PHQ-4 / Brief S-LANSS / FreBAQ
    pain-classification/  Composite: child wiring (config.ts) + model (scoring.ts)
  components/         Svelte UI
    survey/           Shared survey shell + question frame
    results/          Shared results header/actions + screener results view
    pain-classification/  Professional collection page, upload flow + dialogs
    intake/           Intake choice cards
  lib/                Storage, session clearing, PDF reports, charts
    omr/              Reading uploaded sheets: filled PDFs, scans and photos
    pdf/report-kit.ts Shared PDF layout for every results report
  layouts/            Shared Astro layout
  pages/              File-based routes
  styles/global.css   Design tokens and shared styles
```

Clinical constants (maximum scores, cutoffs, bands) live only in each
assessment's `scoring.ts`; the results views, PDFs and composite model
import them from there.

## Privacy and network use

All scoring runs client-side. Patient data (names, responses, results) is
kept in `sessionStorage` under the `path:` prefix, is wiped when the user
leaves an assessment or returns to the hub (`src/lib/session-clear.ts`),
and never leaves the browser.

The site does fetch static assets from third parties:

- **Google Fonts** — the Material Symbols icon font, on every page.
- **Hugging Face / jsDelivr** — the handwriting-recognition model
  (`Xenova/trocr-small-handwritten`, tens of MB) and its ONNX runtime, the
  first time a scanned sheet's handwriting is read (`src/lib/omr/handwriting.ts`).
  Recognition itself runs on the device. Offline or behind a firewall that
  blocks these hosts, the field is simply left for manual entry.

## Open items for the project owner

- **Clinical thresholds to confirm with the PI:** Brief S-LANSS
  "predominantly neuropathic" at ≥ 3 (`assessments/briefslanss/scoring.ts`)
  and FreBAQ "elevated" at ≥ 12 (`assessments/frebaq/scoring.ts`).
- **Questionnaire sources and licensing** (MSI, FreBAQ, PHQ-4, Brief
  S-LANSS) are not yet documented here.
- **Chronic pain pathway** is not built; the intake shows a placeholder.

## Design tokens

Primary color: `#4F2683`. Full palette lives in `src/styles/global.css`
as CSS variables (`--color-primary`, etc.). Component styles reference
the tokens; don't hard-code colors in components.

## Deployment

Pushes to `main` deploy automatically to Cloudflare Pages. See
`DEPLOYMENT.md`.
