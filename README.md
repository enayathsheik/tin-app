# TIN (tinit.in)

## Deploying

`firebase deploy --only hosting` runs `npm run build` first, which is
`vite build` + `scripts/generate-sitemap.js` + `scripts/prerender.js`. The two
scripts **read** live Firestore data (approved jobs, stores) with the
Firebase Admin key to write `dist/sitemap.xml`, `dist/robots.txt` and the
crawler-visible SEO pages (`/jobs`, `/jobs/professional`, `/jobs/skilled`,
`/jobs/needed-now`, every live `/jobs/{id}` and `/store/{id}`).

**The key is found the same way on every build** (first match wins, see
`scripts/firebaseAdmin.js`):

1. `SERVICE_ACCOUNT_PATH` env var
2. `GOOGLE_APPLICATION_CREDENTIALS` env var
3. `./serviceAccountKey.json`
4. the single `./*firebase-adminsdk*.json` at the repo root — the file name
   Firebase gives a downloaded key. Leave it where it is; don't rename it.

Key files are gitignored (`serviceAccountKey.json`, `*firebase-adminsdk*.json`) —
never commit one. Check with `git check-ignore -v <key file>`.

**If no key is found the build fails** rather than silently deploying without
SEO pages. To build without them on purpose (e.g. a quick local build), set
`SKIP_SEO_PAGES=1`.

Database changes deploy separately: `firebase deploy --only firestore:indexes`
(wait for the index to finish building), then `--only firestore:rules`, then
hosting. Storage rules: `--only storage`.

Local development against the emulators (never production data):
`VITE_USE_EMULATORS=true npx vite` with the emulators running. The production
build refuses to run while `VITE_USE_EMULATORS=true` is set.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
