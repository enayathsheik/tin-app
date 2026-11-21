// Shared Firebase Admin SDK bootstrap for build-time scripts
// (scripts/prerender.js, scripts/generate-sitemap.js). These scripts only
// READ live data (approved jobs, stores) to build the SEO pages + sitemap.
//
// Where the service account key is found — the same way on every build,
// first match wins (see README "Deploying"):
//   1. SERVICE_ACCOUNT_PATH env var
//   2. GOOGLE_APPLICATION_CREDENTIALS env var
//   3. ./serviceAccountKey.json at the repo root
//   4. the single ./*firebase-adminsdk*.json file at the repo root (the name
//      Firebase gives a downloaded key — used in place, never copied/renamed)
// Key files are gitignored (`serviceAccountKey.json`, `*firebase-adminsdk*.json`).
//
// If no key is found the build FAILS (see requireServiceAccountPath) instead
// of silently shipping without SEO pages. To build without them on purpose,
// set SKIP_SEO_PAGES=1.
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestore = null;
let resolvedPath = null;

// Returns { path, source } or null. Throws if an env var names a missing file
// (a typo there should be loud, not fall through to some other key).
export function resolveServiceAccountPath() {
  for (const name of ["SERVICE_ACCOUNT_PATH", "GOOGLE_APPLICATION_CREDENTIALS"]) {
    const p = process.env[name];
    if (p) {
      if (!existsSync(p)) throw new Error(`${name} is set to "${p}" but that file doesn't exist.`);
      return { path: p, source: name };
    }
  }
  if (existsSync("./serviceAccountKey.json")) return { path: "./serviceAccountKey.json", source: "repo root serviceAccountKey.json" };
  const matches = readdirSync(".").filter(f => /firebase-adminsdk.*\.json$/.test(f));
  if (matches.length === 1) return { path: path.join(".", matches[0]), source: "repo root *firebase-adminsdk*.json" };
  if (matches.length > 1) {
    throw new Error(`Found ${matches.length} *firebase-adminsdk*.json files at the repo root (${matches.join(", ")}). Set SERVICE_ACCOUNT_PATH to choose one.`);
  }
  return null;
}

// For the top of each build script: returns the key path, or exits — with
// code 0 only when SKIP_SEO_PAGES=1 was set on purpose, otherwise code 1 so
// `npm run build` (and therefore `firebase deploy --only hosting`) fails.
export function requireServiceAccountPath(scriptTag) {
  let found;
  try {
    found = resolveServiceAccountPath();
  } catch (e) {
    console.error(`[${scriptTag}] ${e.message}`);
    process.exit(1);
  }
  if (found) {
    console.log(`[${scriptTag}] Using Firebase Admin key from ${found.source}.`);
    resolvedPath = found.path;
    return found.path;
  }
  if (process.env.SKIP_SEO_PAGES === "1") {
    console.warn(`[${scriptTag}] No Firebase Admin key found — skipping because SKIP_SEO_PAGES=1.`);
    process.exit(0);
  }
  console.error(
    `[${scriptTag}] No Firebase Admin key found, so the SEO pages / sitemap can't be built.\n` +
    `  Put the downloaded key at the repo root (Firebase names it *firebase-adminsdk*.json),\n` +
    `  or set SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS to its path.\n` +
    `  To build without SEO pages on purpose, set SKIP_SEO_PAGES=1. See README "Deploying".`
  );
  process.exit(1);
}

export function initAdmin() {
  if (firestore) return firestore;
  const keyPath = resolvedPath || resolveServiceAccountPath()?.path;
  if (!keyPath) throw new Error("No Firebase Admin key found — see scripts/firebaseAdmin.js.");
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  firestore = getFirestore();
  return firestore;
}

// L2: stores linked to an account by the admin (users/{uid}.storeId) — they
// stay public even if imported and unverified (src/utils/storeVisibility.js).
export async function loadLinkedStoreIds(db) {
  const snap = await db.collection("users").where("storeId", "!=", null).select("storeId").get();
  return new Set(snap.docs.map(d => d.get("storeId")).filter(Boolean));
}
