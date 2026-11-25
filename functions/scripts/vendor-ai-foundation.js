// Firebase only zips the `functions/` directory for deploy, so the
// ai-foundation package (which lives outside it, at packages/ai-foundation)
// can't be required by relative path at runtime. This script copies its
// source files into functions/vendor/ai-foundation/ before deploy so the
// deployed bundle is self-contained. Run via `npm run build` (wired as
// firebase.json's functions predeploy hook).
//
// IMPORTANT: this must land under functions/vendor/, NOT functions/node_modules/.
// 2nd-gen Cloud Functions deploy does not upload node_modules at all — Cloud
// Build reinstalls real dependencies remotely from package.json/lockfile, so
// anything only present in a local node_modules copy (like this package,
// which isn't a real installable npm package) silently disappears in the
// deployed container ("Cannot find module 'ai-foundation'" at runtime).
// Plain source files under functions/ itself (like ai.js) DO get uploaded,
// so vendoring here and requiring by relative path is what actually works.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'packages', 'ai-foundation');
const DEST = path.join(__dirname, '..', 'vendor', 'ai-foundation');
const SKIP_DIRS = new Set(['node_modules', 'tests', '.git']);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);
console.log(`[vendor-ai-foundation] copied ${SRC} -> ${DEST}`);

// The app's own TIN Jobs logic for functions/jobs.js (plain ES modules with no
// React/Firebase imports), copied as-is so the server and the app can't drift.
const APP_SRC = path.join(__dirname, '..', '..', 'src');
const JOBS_DEST = path.join(__dirname, '..', 'vendor', 'jobs');
fs.rmSync(JOBS_DEST, { recursive: true, force: true });
for (const f of ['data/jobsTaxonomy.js', 'utils/jobProfile.js', 'utils/applications.js', 'utils/shortlist.js', 'utils/candidateSearch.js', 'utils/pricing.js', 'utils/phoneAuth.js', 'utils/jobRoles.js']) {
  fs.mkdirSync(path.dirname(path.join(JOBS_DEST, f)), { recursive: true });
  fs.copyFileSync(path.join(APP_SRC, f), path.join(JOBS_DEST, f));
}
fs.writeFileSync(path.join(JOBS_DEST, 'package.json'), '{ "type": "module", "private": true }\n');
console.log(`[vendor-ai-foundation] copied TIN Jobs logic -> ${JOBS_DEST}`);

// TIN Jobs option lists for the AI profile helper (suggestJobProfile).
// src/data/jobsTaxonomy.js is an ES module in the web app, outside
// functions/, so write the lists it needs as plain JSON next to the vendored
// package. Regenerated on every build, so it can never drift from the app.
const TAXONOMY_SRC = path.join(__dirname, '..', '..', 'src', 'data', 'jobsTaxonomy.js');
const TAXONOMY_DEST = path.join(__dirname, '..', 'vendor', 'jobsTaxonomy.json');
const { pathToFileURL } = require('url');
import(pathToFileURL(TAXONOMY_SRC).href).then((tax) => {
  const pick = (list) => list.map(({ key, label, labelHi }) => (labelHi ? { key, label, labelHi } : { key, label }));
  const out = {
    TRADES: pick(tax.TRADES), FUNCS: pick(tax.FUNCS), TYPES: pick(tax.TYPES), AVAIL: pick(tax.AVAIL),
    EDU: pick(tax.EDU), LANES: pick(tax.LANES), SKILLED_WORK_TYPES: [...tax.SKILLED_WORK_TYPES],
  };
  fs.writeFileSync(TAXONOMY_DEST, JSON.stringify(out, null, 2) + '\n');
  console.log(`[vendor-ai-foundation] wrote ${TAXONOMY_DEST}`);
}).catch((err) => {
  console.error('[vendor-ai-foundation] could not build jobsTaxonomy.json:', err);
  process.exit(1);
});
