# Deploying PATH to Cloudflare Pages

The site is a static Astro build. Every push to `main` deploys automatically;
pull requests get their own preview URLs without affecting production.

## Cloudflare Pages settings

In **Workers & Pages** → the PATH project → **Settings**:

- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** *(empty)*
- **Environment variable:** `NODE_VERSION = 22` — Astro 7 and pdf.js 6
  need Node 22.13 or later; an older default fails the build.

## Setting up from scratch

If the project ever needs recreating: in Cloudflare, **Workers & Pages** →
**Create** → **Pages** → **Connect to Git**, authorize GitHub, select
**Jamie215/PATH**, and use the settings above. The first build takes about a
minute and yields a `*.pages.dev` URL. Update `site` in `astro.config.mjs`
to the production URL.

## Before pushing

Cloudflare only runs the build. Type errors and failing tests are caught by
the GitHub Actions CI workflow on each pull request, or locally with:

```bash
npm run check && npm test && npm run build
```
