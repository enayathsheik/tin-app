// One-time seed for homConfig/catalog — the single editable-catalog doc the
// HOM Systems "House of Mod" microsite reads (profiles/colours/glasses/
// addons/bars/rates). Values are the real HOM_Kitchen_Calculator.xlsx
// numbers for Block 1; the admin edits this doc going forward.
//
// Idempotent by default — does nothing if homConfig/catalog already exists.
// Run locally with Node (NOT a Cloud Function). Requires firebase-admin:
//   npm install firebase-admin --no-save
//
// Usage:
//   node scripts/seed-hom-catalog.mjs --service-account=./serviceAccountKey.json
//       Seeds homConfig/catalog only if it does not already exist.
//
//   node scripts/seed-hom-catalog.mjs --service-account=./serviceAccountKey.json --force
//       Overwrites homConfig/catalog even if it already exists.

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

if (!args["service-account"]) {
  console.error("Missing --service-account=/path/to/serviceAccountKey.json");
  process.exit(1);
}

const FORCE = !!args.force;

const serviceAccount = JSON.parse(readFileSync(args["service-account"], "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CATALOG = {
  profiles: [
    { id: "KP-WIDE", name: "Type 1 — Wide inner support", photos: [], active: true },
    { id: "KP-SLIM", name: "Type 2 — Slim 19×5mm", photos: [], active: true },
  ],
  colours: [
    { id: "col-gold", name: "Brush Gold", photos: [], active: true },
    { id: "col-rose", name: "Rose Gold", photos: [], active: true },
    { id: "col-black", name: "Black", photos: [], active: true },
    { id: "col-brown", name: "Brown", photos: [], active: true },
  ],
  glasses: [
    { id: "GL-01", name: "Plain Clear — Non Toughened", rate: 50, photos: [], active: true },
    { id: "GL-02", name: "Clear — Toughened", rate: 100, photos: [], active: true },
    { id: "GL-03", name: "Figure Glass — Non Toughened", rate: 150, photos: [], active: true },
    { id: "GL-04", name: "Tinted — Toughened", rate: 150, photos: [], active: true },
  ],
  addons: [
    { id: "GL-ADD01", name: "Stick-on Film", rate: 225 },
    { id: "GL-ADD02", name: "Fabric Lamination", rate: 275 },
    { id: "GL-ADD03", name: "Double Sandwich", rate: 100 },
  ],
  bars: [
    { label: "8 ft", lengthMm: 2438, available: false, ratePerBar: 1440 },
    { label: "10 ft", lengthMm: 3048, available: true, ratePerBar: 1200 },
    { label: "12 ft", lengthMm: 3658, available: false, ratePerBar: 2160 },
    { label: "16 ft", lengthMm: 4877, available: false, ratePerBar: 2880 },
  ],
  handleRatePerFt: 18,
  hinges: [
    { id: "std", name: "Standard Hinge", rate: 180 },
    { id: "soft", name: "Soft-close Hinge", rate: 150 },
  ],
  makingPerShutter: 500,
  glassDeductMm: 0, // full frame today; admin adjusts later
  gstPct: 18,
  // PLACEHOLDER — flat transport charge per order, needs confirming with
  // ops/logistics before this is treated as final pricing.
  transportFlat: 300,
};

async function main() {
  const ref = db.collection("homConfig").doc("catalog");
  const snap = await ref.get();

  if (snap.exists && !FORCE) {
    console.log("homConfig/catalog already exists — nothing written. Pass --force to overwrite.");
    return;
  }

  await ref.set(CATALOG);
  console.log(`homConfig/catalog ${snap.exists ? "overwritten (--force)" : "seeded"}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fatal:", e); process.exit(1); });
