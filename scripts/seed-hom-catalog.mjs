// Seed/reshape for homConfig/catalog — the single editable-catalog doc the
// HOM Systems microsite + admin Rate List/Catalogue read (brands with
// per-brand profile types, bar stock, and handle types; colours; glasses;
// addons; hinge categories with per-brand rates; lift-up hydraulics; flat
// rates). Placeholder numbers below are deterministic; the admin edits them
// going forward via the Rate List / Catalogue tabs.
//
// homConfig/catalog is admin CONFIG, not transactional data — every order
// freezes its own pricingSnapshot + catalogSnapshot at creation (see
// src/utils/homOrder.js's freezeCatalogRates), so reshaping this doc can
// never change an already-placed order's price. That's what makes the
// reshape below safe as a deliberate exception to additive-only.
//
// Idempotent: does nothing if the doc already has the NEW shape (detected
// via `brands` being present). If the doc has the OLD shape (`profiles` /
// `bars` / `hinges` / `handleRatePerFt`, pre-overhaul) or doesn't exist yet,
// it seeds/rewrites to the new shape. --force always overwrites regardless
// of current shape.
//
// Run locally with Node (NOT a Cloud Function). Requires firebase-admin:
//   npm install firebase-admin --no-save
//
// Usage:
//   node scripts/seed-hom-catalog.mjs --service-account=./serviceAccountKey.json
//   node scripts/seed-hom-catalog.mjs --service-account=./serviceAccountKey.json --force

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

// Every regularBars/handleType.bars list: only "10 ft" is available; the
// other three lengths exist so the admin can flip them on/off + set a rate
// later without adding new bar rows by hand. Unavailable lengths' rates are
// a proportional placeholder (never read by the engine while unavailable).
function barSet(tenFtRate) {
  const scale = (lengthMm) => Math.round((tenFtRate * lengthMm) / 3048);
  return [
    { label: "8 ft", lengthMm: 2438, available: false, ratePerBar: scale(2438) },
    { label: "10 ft", lengthMm: 3048, available: true, ratePerBar: tenFtRate },
    { label: "12 ft", lengthMm: 3658, available: false, ratePerBar: scale(3658) },
    { label: "16 ft", lengthMm: 4877, available: false, ratePerBar: scale(4877) },
  ];
}

function profileTypes() {
  return [
    { id: "KP-WIDE", name: "Type 1 — Wide inner support", photos: [], active: true },
    { id: "KP-SLIM", name: "Type 2 — Slim 19×5mm", photos: [], active: true },
  ];
}

function handleTypes(ht1Rate, ht2Rate) {
  return [
    { id: "HT-1", name: "Handle Type 1", photos: [], active: true, bars: barSet(ht1Rate) },
    { id: "HT-2", name: "Handle Type 2", photos: [], active: true, bars: barSet(ht2Rate) },
  ];
}

const CATALOG = {
  brands: [
    { id: "HOM", name: "HOM", active: true, profileTypes: profileTypes(), regularBars: barSet(1200), handleTypes: handleTypes(1600, 1800) },
    { id: "veneto-cnr", name: "Veneto (CNR)", active: true, profileTypes: profileTypes(), regularBars: barSet(1400), handleTypes: handleTypes(1900, 2100) },
    { id: "astronea-kzone", name: "Astronea (Kzone)", active: true, profileTypes: profileTypes(), regularBars: barSet(1300), handleTypes: handleTypes(1750, 1950) },
    { id: "others", name: "Others", active: true, profileTypes: profileTypes(), regularBars: barSet(1200), handleTypes: handleTypes(1600, 1800) },
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
  hingeCategories: [
    {
      id: "regular_side", name: "Regular Side Hinge",
      brands: [
        { id: "hettich", name: "Hettich", rate: 180, active: true },
        { id: "hafele", name: "Häfele", rate: 200, active: true },
        { id: "ebco", name: "Ebco", rate: 150, active: true },
        { id: "blum", name: "Blum", rate: 260, active: true },
      ],
    },
    {
      id: "air", name: "Air Hinge",
      brands: [
        { id: "hettich", name: "Hettich", rate: 320, active: true },
        { id: "hafele", name: "Häfele", rate: 350, active: true },
        { id: "blum", name: "Blum", rate: 480, active: true },
      ],
    },
  ],
  liftUp: {
    hydraulicSystems: [
      { id: "hettich-lift", name: "Hettich Lift", rate: 950, active: true },
      { id: "hafele-lift", name: "Häfele Lift", rate: 1100, active: true },
      { id: "blum-aventos", name: "Blum Aventos", rate: 1600, active: true },
    ],
    qtyPerShutter: 1,
  },
  makingPerShutter: 500,
  glassDeductMm: 0, // full frame today; admin adjusts later
  gstPct: 18,
  // PLACEHOLDER — flat transport charge per order, needs confirming with
  // ops/logistics before this is treated as final pricing.
  transportFlat: 300,
  kerfMm: 0,
};

// New shape iff `brands` is present. Anything else (no doc at all, or the
// pre-overhaul `profiles`/`bars`/`hinges`/`handleRatePerFt` shape) is
// treated as needing a (re)seed.
function isNewShape(data) {
  return Array.isArray(data?.brands);
}

async function main() {
  const ref = db.collection("homConfig").doc("catalog");
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;

  if (snap.exists && isNewShape(data) && !FORCE) {
    console.log("homConfig/catalog already has the new shape — nothing written. Pass --force to overwrite.");
    return;
  }

  const reason = !snap.exists ? "seeded (no prior doc)" : FORCE ? "overwritten (--force)" : "reshaped (old shape detected)";
  await ref.set(CATALOG);
  console.log(`homConfig/catalog ${reason}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fatal:", e); process.exit(1); });
