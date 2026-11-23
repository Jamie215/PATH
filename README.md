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
npm ci           # install the exact versions in package-lock.json
npm run dev      # dev server at http://localhost:4321
npm test         # unit tests (vitest)
npm run check    # type-check .astro (astro check) and .svelte (svelte-check)
npm run build    # static build into dist/
npm run test:e2e # browser smoke tests against dist/ (run after build)
```

CI (`.github/workflows/ci.yml`) runs `check`, `test`, `build` and `test:e2e`
on every pull request and on `main`. The browser tests (`e2e/`) use
Playwright: they take each survey, open its results and download the PDF.
On a new machine, run `npx playwright install chromium` once first.

## Project structure

```
src/
  assessments/        Per-assessment questions, scoring, OMR sheet templates
    registry.ts       Names, descriptions and hub cards for every assessment
    screening.ts      Shared shape of the single-total screeners
    screeners.ts      List of screeners; each has a <slug>/definition.ts
    pain-classification/  Composite: child wiring (config.ts) + model (scoring.ts)
  components/         Svelte UI
    survey/           Shared survey shell + question frame
    results/          Shared results header/actions + screener results view
    pain-classification/  Professional collection page, upload flow + dialogs
    intake/           Intake choice cards
  lib/                Storage and key names, page URLs (routes.ts), session
                      clearing, charts
    omr/              Answer sheets: printing them (sheet.ts) and reading
                      uploaded ones (filled PDFs, scans and photos)
    pdf/              PDF results reports; report-kit.ts is the shared layout
  layouts/            Shared Astro layout
  pages/              File-based routes; [screener]/ serves every screener
e2e/                  Browser smoke tests (Playwright)
  styles/global.css   Design tokens and shared styles
```

Clinical constants (maximum scores, cutoffs, bands) live only in each
assessment's `scoring.ts`; the results views, PDFs and composite model
import them from there.

## Adding a screener

A *screener* here is a questionnaire with one rating per item and a single
total score, like PHQ-4. To add one, say with the slug `newtool`:

1. `src/assessments/newtool/questions.ts`: the items and the rating scale.
2. `src/assessments/newtool/scoring.ts`: maximum score, cutoffs and `score()`.
3. `src/assessments/newtool/omr-template.ts`: the printable answer sheet
   (copy a sibling's and adjust the layout).
4. `src/assessments/newtool/definition.ts`: ties the three together, with
   the survey intro and the PDF report text.
5. Add it to `SCREENERS` in `src/assessments/screeners.ts`, and give it a
   name, description and icon in `src/assessments/registry.ts`.

That gives it a survey page (`/newtool/`), a results page and a PDF
report. To feed it into Pain Classification, also add
`screenerChild(NEWTOOL)` to `ACUTE_CHILDREN` in
`src/assessments/pain-classification/config.ts`; the model in its
`scoring.ts` would need new coefficients for it. `npm test` checks the
pieces agree, for example that the answer sheet has one row per question.

## Privacy and network use

All scoring runs client-side. Patient data (names, responses, results) is
kept in `sessionStorage` under the `path:` prefix, is wiped when the user
leaves an assessment or returns to the hub (`src/lib/session-clear.ts`),
and never leaves the browser.

The site serves its own assets — including the icon font (a subset built by
`scripts/fetch-icons.mjs`) and the ONNX Runtime WebAssembly (copied from
`node_modules` by `scripts/copy-ort.mjs` before `dev`/`build`). The one
outside request is the handwriting-recognition model
(`Xenova/trocr-small-handwritten`, ~60–70 MB), downloaded from Hugging Face
the first time a scanned sheet's handwriting is read and cached by the browser
after that. Recognition runs on the device; if the model can't be fetched, the
field is simply left for manual entry. The model version is set by
`MODEL_REVISION` in `src/lib/omr/handwriting.ts` — change it deliberately and
re-check recognition.

A Content-Security-Policy (`security.csp` in `astro.config.mjs`) restricts
every page to the site itself plus Hugging Face for the model; other response
headers are in `public/_headers`. Adding a new icon: add its name to
`scripts/icons.json` and run `node scripts/fetch-icons.mjs` (a test fails
until you do).

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

## Hand-off

For an overview of the design, each assessment workflow and the scoring
logic, see `HANDOFF.md`.
