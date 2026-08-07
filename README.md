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

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

## Project structure

```
src/
  assessments/      One folder per assessment + a registry
    registry.ts     Single source of truth for hub home
  components/       Reusable Svelte components (forms, charts, modals)
  layouts/          Shared Astro layouts
  pages/            File-based routes
  styles/           Global CSS and design tokens
```

## Design tokens

Primary color: `#4F2683`. Full palette lives in `src/styles/global.css`
as CSS variables (`--color-primary`, etc.). Component styles reference
the tokens; don't hard-code colors in components.

## Deployment

Pushes to `main` deploy automatically to Cloudflare Pages once the repo
is connected. See `DEPLOYMENT.md`.
