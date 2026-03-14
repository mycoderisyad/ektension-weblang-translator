# AGENTS.md

## Cursor Cloud specific instructions

### Overview

WebLang Translator is a Chrome Extension (Manifest V3) for web page translation with multi-provider support and AI analysis. It is a single-package repo with one dev dependency (`esbuild`).

### Build and Dev

- `npm run build` -- one-shot production build to `build/`
- `npm run dev` (or `npm run watch`) -- esbuild watch mode with live rebuilds
- `npm run clean` -- removes `build/`

### Testing in Chrome

There is no automated test suite. Manual testing requires:

1. Build the extension (`npm run build` or start `npm run dev`)
2. Open `chrome://extensions`, enable Developer mode
3. Click "Load unpacked" and select the `build/` folder
4. Navigate to any web page and interact with the extension popup/side panel

### Lint / Formatting

No ESLint, Prettier, or other lint/format tools are configured. If adding them, update `package.json` scripts accordingly.

### GitHub Pages

The `docs/` folder is configured for GitHub Pages via Jekyll (cayman theme). The privacy policy at `docs/privacy-policy.md` is set as the root page (`permalink: /`). Deployment is automated via `.github/workflows/deploy-pages.yml` on pushes to `main` that modify `docs/`. The repository owner must enable GitHub Pages in Settings > Pages > Source: "GitHub Actions" for the workflow to deploy.

### Gotchas

- The extension uses `chrome.*` APIs that only work inside a Chromium browser extension context; content scripts and background service worker cannot be tested outside Chrome.
- `npm run dev` runs esbuild in watch mode and does not exit; it must be backgrounded or run in a separate terminal.
