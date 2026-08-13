// HOM Systems — kitchen-shutter pricing engine.
// Pure, unit-testable functions — mirrors HOM_Kitchen_Calculator.xlsx exactly
// (no per-sqft profile pricing). Both exports take the homConfig/catalog
// document (see scripts/seed-hom-catalog.mjs) as their first argument so the
// admin's later catalog edits flow through with no code change here.

const MM_PER_FT = 304.8;
const MM2_PER_SQFT = 92903;

function round(n) {
  return Math.round(n);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findById(list, id) {
  return (list || []).find((item) => item.id === id) || null;
}

// Cheapest available+long-enough bar for this cut length. `ok: false` (cost
// 0, label "n/a") means no catalog bar can fit `longest` — the caller must
// surface that as a warning, not silently price the cabinet at a discount.
function pickCheapestBar(bars, longest, regularCut) {
  let best = null;
  for (const bar of bars || []) {
    if (!bar.available || longest > bar.lengthMm) continue;
    const barsNeeded = Math.ceil(regularCut / bar.lengthMm);
    const cost = barsNeeded * bar.ratePerBar;
    if (!best || cost < best.cost) best = { cost, label: bar.label };
  }
  return best ? { ...best, ok: true } : { cost: 0, label: "n/a", ok: false };
}

// Glass cut size for one shutter — shutter size minus the deduct margin on
// all four sides. Factored out of priceCabinet (which uses it for
// glassArea) so chit-building code (Block 3) can derive the same cut size
// for the glass supplier's chit without re-deriving the formula itself.
export function glassCutSize(shutterW, shutterH, glassDeductMm) {
  const deduct = glassDeductMm || 0;
  return { gW: shutterW - 2 * deduct, gH: shutterH - 2 * deduct };
}

// Prices one line of `qty` identical cabinets.
export function priceCabinet(catalog, input) {
  const {
    profileId,
    glassId,
    addons = [],
    withHandle = false,
    hingeId,
    shuttersPerCab,
    hingesPerShutter = 2,
    cabW,
    cabH,
    qty,
  } = input;

  const glass = findById(catalog.glasses, glassId);
  const hinge = findById(catalog.hinges, hingeId);
  if (!glass) throw new Error(`Unknown glass id "${glassId}"`);
  if (!hinge) throw new Error(`Unknown hinge id "${hingeId}"`);

  const shutterW = round(cabW / shuttersPerCab);
  const shutterH = cabH;
  const totalShutters = shuttersPerCab * qty;

  const handleCut = withHandle ? totalShutters * shutterH : 0;
  const regularCut = withHandle
    ? totalShutters * (1 * shutterH + 2 * shutterW)
    : totalShutters * (2 * shutterH + 2 * shutterW);

  const longest = Math.max(shutterH, shutterW);
  const bar = pickCheapestBar(catalog.bars, longest, regularCut);

  const handleCost = round((handleCut / MM_PER_FT) * catalog.handleRatePerFt);

  const { gW, gH } = glassCutSize(shutterW, shutterH, catalog.glassDeductMm);
  const glassArea = round2((gW * gH * totalShutters) / MM2_PER_SQFT);

  const addonRate = addons.reduce((sum, addonId) => {
    const addon = findById(catalog.addons, addonId);
    if (!addon) throw new Error(`Unknown addon id "${addonId}"`);
    return sum + addon.rate;
  }, 0);
  const glassRate = glass.rate + addonRate;
  const glassCost = round(glassArea * glassRate);

  const hingeCost = hinge.rate * hingesPerShutter * totalShutters;
  const makingCost = catalog.makingPerShutter * totalShutters;

  const cabinetTotal = glassCost + bar.cost + handleCost + hingeCost + makingCost;

  return {
    profileId,
    shutterW,
    shutterH,
    totalShutters,
    handleCut,
    regularCut,
    longest,
    barLabel: bar.label,
    barOk: bar.ok,
    profileBarsCost: bar.cost,
    handleCost,
    glassArea,
    glassRate,
    glassCost,
    hingeCost,
    makingCost,
    cabinetTotal,
  };
}

// Sums an order's cabinet lines into basic/gst/transport/grand totals.
// `cabinets` may be raw per-cabinet inputs (priced here) or already-priced
// lines from priceCabinet — either way each contributes its cabinetTotal.
export function priceOrder(catalog, cabinets) {
  const priced = cabinets.map((c) =>
    typeof c.cabinetTotal === "number" ? c : priceCabinet(catalog, c)
  );
  const basic = priced.reduce((sum, c) => sum + c.cabinetTotal, 0);
  const gst = basic * (catalog.gstPct / 100);
  const transport = cabinets.length > 0 ? catalog.transportFlat : 0;
  const grand = basic + gst + transport;
  return { basic, gst, transport, grand, cabinets: priced };
}
