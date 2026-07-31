// ============================================================
// TIN — Phase 1 migration: backfill `context` onto conversations/{id}
// File: functions/scripts/backfill-conversation-context.js
// Run:  node functions/scripts/backfill-conversation-context.js
//
// Additive, idempotent, read-then-write — never destructive. Adds the new
// `context` ('personal' | 'organization') field to every existing
// conversation doc that doesn't already have one, mapped from its current
// `scope`:
//   scope in [personal, external] -> context: 'personal'
//   scope in [org, team]          -> context: 'organization'
// Docs that already have a `context` field are left untouched (safe to
// re-run — a second pass does nothing). Docs with an unrecognized/missing
// `scope` are SKIPPED and logged, never guessed — see firestore.rules'
// context==null legacy branch, which keeps them working exactly as before
// until a human resolves the shape and re-runs this script.
//
// NOT run as part of writing this migration — per the Phase 1 deploy order,
// this only runs after: (1) the rules/schema diff is reviewed and approved,
// (2) the extended emulator suite is green, (3) firestore:rules + functions
// are deployed. Run it after that, then re-run with --verify-only to
// confirm the context==null count is zero before the legacy-branch removal
// deploy (a separate, later rules change — not part of this script).
// ============================================================

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname, "..", "..",
  "trade-intelligence-netwo-97997-firebase-adminsdk-fbsvc-38509e90aa.json"
);

const SCOPE_TO_CONTEXT = {
  personal: "personal",
  external: "personal",
  org: "organization",
  team: "organization",
};

const PAGE_SIZE = 300; // well under Firestore's 500-write batch limit
const VERIFY_ONLY = process.argv.includes("--verify-only");

async function main() {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  let updated = 0;
  let alreadySet = 0;
  let skipped = 0;
  const skippedIds = [];

  let lastDoc = null;
  for (;;) {
    let q = db.collection("conversations").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.context != null) {
        alreadySet++;
        continue;
      }
      const context = SCOPE_TO_CONTEXT[data.scope];
      if (!context) {
        skipped++;
        skippedIds.push({ id: docSnap.id, scope: data.scope ?? "(missing)" });
        continue;
      }
      if (!VERIFY_ONLY) {
        batch.update(docSnap.ref, { context });
        batchWrites++;
      }
      updated++;
    }

    if (batchWrites > 0) await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE_SIZE) break;
  }

  console.log(`${VERIFY_ONLY ? "[verify-only] " : ""}context backfill complete.`);
  console.log(`  already had context: ${alreadySet}`);
  console.log(`  ${VERIFY_ONLY ? "would update" : "updated"}:          ${updated}`);
  console.log(`  skipped (unrecognized/missing scope): ${skipped}`);
  if (skippedIds.length) {
    console.log("  skipped doc ids (resolve manually, then re-run):");
    skippedIds.forEach(({ id, scope }) => console.log(`    - ${id} (scope: ${scope})`));
  }

  // Actual run: updated docs now really have context set, so only `skipped`
  // remains null. Verify-only: nothing was written, so both `updated`
  // (would-be) and `skipped` are still null.
  const remainingNullContext = VERIFY_ONLY ? updated + skipped : skipped;
  console.log(`\ncontext==null docs remaining after this run: ${remainingNullContext}`);
  console.log(remainingNullContext === 0
    ? "Zero remaining — safe to schedule the legacy-branch removal rules deploy."
    : "Non-zero — do NOT remove the context==null legacy branch yet.");

  process.exit(0);
}

main().catch(err => {
  console.error("[backfill-conversation-context] failed:", err);
  process.exit(1);
});
