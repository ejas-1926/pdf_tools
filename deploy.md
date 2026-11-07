# Deploying PDF Tools to balancia.me

The site is fully static — no server, no database, no environment variables.
Everything the app needs is in the `dist/` folder after a build.

## 1. Build

```bash
npm install
npm run build
```

Output: `dist/` (upload the **contents** of this folder, not the folder itself, unless your host asks for a folder).

The build uses relative asset paths (`base: './'`), so the site works at:

- `https://balancia.me/` (domain root)
- `https://balancia.me/pdf-tools/` (subpath)
- `https://tools.balancia.me/` (subdomain)

No configuration change is needed between these options.

## 2. Upload to your host

### cPanel / traditional hosting (where balancia.me lives)

1. Run `npm run build` locally.
2. Open File Manager (or FTP/SFTP with FileZilla) and go to
   `public_html/` (domain root) **or** `public_html/pdf-tools/` (subpath).
3. Upload everything inside `dist/`:
   - `index.html`
   - `favicon.svg`
   - the whole `assets/` folder
4. Done — visit the URL. No `.htaccess` or rewrite rules are required
   (the app is a single page and uses relative paths).

### Netlify

- Drag-and-drop: open [app.netlify.com/drop](https://app.netlify.com/drop)
  and drag the `dist/` folder onto the page.
- Or CLI:

  ```bash
  npm i -g netlify-cli
  netlify deploy --dir=dist --prod
  ```

### Vercel

```bash
npm i -g vercel
vercel deploy --prod dist
```

### Cloudflare Pages

Dashboard → Pages → Create project → Upload assets → select the `dist/` folder.

### GitHub Pages

Push `dist/` to a `gh-pages` branch (or use `npx gh-pages -d dist`).
Relative paths are already configured, so it works from
`https://<user>.github.io/<repo>/` as well as custom domains.

## 3. Optional: custom domain / subpath notes

- **Subpath (balancia.me/pdf-tools):** works as-is. If your main site is a
  SPA with a catch-all rewrite, add an exception so that
  `/pdf-tools` and `/pdf-tools/*` serve `pdf-tools/index.html` — usually not
  needed since the URL path stays at the directory.
- **HTTPS:** recommended but not required; all processing is client-side, so
  no sensitive data transits the network either way.
- **Cache headers:** `assets/` files are content-hashed — set long cache
  lifetimes (e.g. `Cache-Control: public, max-age=31536000, immutable`) for
  that folder, and a short lifetime for `index.html`.

## 4. Verifying the deployment

1. Open the site — the header band, lavender background with the B mark, and
   lattice-textured cards should all render (a broken background image means
   the `assets/` folder wasn't fully uploaded).
2. Run **Minimize size** on any PDF — the before/after report proves the
   whole pipeline works.
3. Favicon should appear in the browser tab.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank white page | `assets/` folder missing or partially uploaded | Re-upload all of `dist/` |
| Background images missing, rest fine | old `/bg/` path cached by the browser | Hard refresh (Ctrl+Shift+R) |
| Works locally, 404 on host | uploaded to wrong directory, or host needs `index.html` at that path | Check path; re-upload |
| Fonts/layout look off | host is serving stale CSS | Hard refresh; check cache headers |

## Local development

```bash
npm run dev        # dev server with hot reload
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```
