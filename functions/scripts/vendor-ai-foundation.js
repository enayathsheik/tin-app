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
