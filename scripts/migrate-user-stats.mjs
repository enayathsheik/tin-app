// One-time migration: move points/storesAdded/citiesCovered/level off the
// root users/{uid} document and into users/{uid}/stats/summary.
//
// Run locally with Node (NOT a Cloud Function). Requires firebase-admin:
//   npm install firebase-admin --no-save
//
// Usage:
//   node scripts/migrate-user-stats.mjs --service-account=./serviceAccountKey.json
//       Dry run (default) — reads every user, prints exactly what it WOULD
//       write/strip, writes nothing.
//
//   node scripts/migrate-user-stats.mjs --service-account=./serviceAccountKey.json --live
//       Actually performs the writes.
//
//   Add --limit=5 to restrict to the first N users, for a small live test
//   before running against the full collection.

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

if (!args["service-account"]) {
  console.error("Missing --service-account=/path/to/serviceAccountKey.json");
  process.exit(1);
}

const LIVE = !!args.live;
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;

const serviceAccount = JSON.parse(readFileSync(args["service-account"], "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Same level thresholds as src/data/constants.js CONTRIBUTOR_LEVELS —
// duplicated here so this script has no dependency on the app's src tree.
const CONTRIBUTOR_LEVELS = [
  { name: "Bronze", min: 0, max: 99 },
  { name: "Silver", min: 100, max: 499 },
  { name: "Gold", min: 500, max: 1999 },
  { name: "Platinum", min: 2000, max: 9999 },
  { name: "Legend", min: 10000, max: Infinity },
];
function getLevel(pts) {
  return (CONTRIBUTOR_LEVELS.find(l => pts >= l.min && pts <= l.max) || CONTRIBUTOR_LEVELS[0]).name;
}

const STAT_FIELDS = ["points", "storesAdded", "citiesCovered", "level"];

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE — will write to Firestore" : "DRY RUN — no writes"}`);
  if (LIMIT) console.log(`Limit: first ${LIMIT} users only`);
  console.log("");

  const snap = await db.collection("users").get();
  const docs = LIMIT ? snap.docs.slice(0, LIMIT) : snap.docs;

  let processed = 0, migrated = 0, alreadyDone = 0, unexpectedShape = 0, failed = 0;
  const failures = [];
  const unexpected = [];

  for (const userDoc of docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    processed++;

    try {
      const hasAnyStatField = STAT_FIELDS.some(f => f in data);
      if (!hasAnyStatField) {
        // Nothing to migrate for this user (already migrated, or never had stats — e.g. retailer/consumer created after this schema shipped)
        alreadyDone++;
        continue;
      }

      const points = typeof data.points === "number" ? data.points : 0;
      const storesAdded = typeof data.storesAdded === "number" ? data.storesAdded : 0;
      const citiesCovered = typeof data.citiesCovered === "number" ? data.citiesCovered : 0;
      const level = data.level || getLevel(points);

      if (typeof data.points !== "undefined" && typeof data.points !== "number") {
        unexpectedShape++;
        unexpected.push(`${uid}: points is ${typeof data.points} (${JSON.stringify(data.points)}), coerced to 0`);
      }

      const statsPayload = { points, storesAdded, citiesCovered, level };
      const stripFields = {};
      STAT_FIELDS.forEach(f => { if (f in data) stripFields[f] = FieldValue.delete(); });

      console.log(`[${LIVE ? "WRITE" : "DRY"}] ${uid} (${data.name || data.email || "?"})`);
      console.log(`    stats/summary <- ${JSON.stringify(statsPayload)}`);
      console.log(`    root doc strips <- ${Object.keys(stripFields).join(", ")}`);

      if (LIVE) {
        // Write stats/summary FIRST. Only strip the root doc's fields once that
        // write has actually succeeded, so a failure never leaves data half-moved.
        await db.collection("users").doc(uid).collection("stats").doc("summary").set(statsPayload, { merge: true });
        await db.collection("users").doc(uid).update(stripFields);
      }

      migrated++;
    } catch (err) {
      failed++;
      failures.push(`${uid}: ${err.message}`);
      console.error(`    FAILED: ${err.message}`);
    }
  }

  console.log("\n===== MIGRATION SUMMARY =====");
  console.log(`Mode:              ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log(`Processed:         ${processed}`);
  console.log(`Migrated:          ${migrated}`);
  console.log(`Already migrated / no stats fields: ${alreadyDone}`);
  console.log(`Unexpected shape:  ${unexpectedShape}`);
  console.log(`Failed:            ${failed}`);
  if (unexpected.length) {
    console.log("\nUnexpected shapes:");
    unexpected.forEach(l => console.log("  " + l));
  }
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach(l => console.log("  " + l));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error("Fatal:", e); process.exit(1); });
