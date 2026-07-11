// Shared Firebase Admin SDK bootstrap for build-time scripts
// (scripts/prerender.js, scripts/generate-sitemap.js).
//
// One-time setup: download a service account key from
//   Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
// and save it as `serviceAccountKey.json` at the repo root (already gitignored).
// Override the path with the SERVICE_ACCOUNT_PATH env var if you keep it elsewhere.
import { existsSync, readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestore = null;

export function initAdmin() {
  if (firestore) return firestore;

  const path = process.env.SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
  if (!existsSync(path)) {
    throw new Error(
      `Missing Firebase Admin service account key at "${path}".\n` +
      `Download one from Firebase Console -> Project Settings -> Service Accounts -> ` +
      `Generate new private key, save it as serviceAccountKey.json at the repo root ` +
      `(or set SERVICE_ACCOUNT_PATH to point elsewhere).`
    );
  }

  const serviceAccount = JSON.parse(readFileSync(path, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  firestore = getFirestore();
  return firestore;
}
