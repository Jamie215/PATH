# Deploying PATH to Cloudflare Pages

One-time setup, then every push to `main` deploys automatically.

## 1. Push the scaffold to GitHub

```bash
cd path
git init
git add .
git commit -m "Scaffold: Astro + Svelte + hub home"
git branch -M main
git remote add origin https://github.com/Jamie215/PATH.git
git push -u origin main
```

If the repo already has a `README.md` on `main` and the push is
rejected, either pull first (`git pull origin main --allow-unrelated-histories`)
or force-push (`git push -u origin main --force`) if you're sure
you want the scaffold's README to win.

## 2. Connect Cloudflare Pages

1. Sign in to [Cloudflare](https://dash.cloudflare.com). The free
   account is sufficient.
2. In the sidebar: **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
3. Authorize Cloudflare to access GitHub, then select **Jamie215/PATH**.
4. Set up build:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** *(leave empty)*
5. Click **Save and Deploy**.

The first build takes about a minute. When it succeeds you'll get a
URL like `path-xxx.pages.dev`.

## 3. Subsequent deploys

Push to `main` → Cloudflare builds and deploys automatically.
Pull requests get their own preview URLs without affecting production.

## Troubleshooting

**Build fails on Cloudflare but works locally**

Cloudflare Pages uses Node 20 by default but a different default can
cause mismatches. To pin the Node version, add an environment variable
in Pages settings: `NODE_VERSION = 20`.

**TypeScript errors in CI**

Astro doesn't type-check during build by default, so most TS issues
won't break the deploy. To catch them earlier, run `npx astro check`
locally before pushing.
