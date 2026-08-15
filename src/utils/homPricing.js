// HOM Systems — kitchen-shutter pricing engine (rate-list + optimiser
// overhaul). Pricing is at the ORDER level: cut pieces from every cabinet in
// the order are pooled into groups (by brand+profileType+colour for the
// regular profile, and by brand+handleType+colour for the handle profile)
// and each group is packed into stock bars with a deterministic
// First-Fit-Decreasing cutting-stock optimiser — NOT priced cabinet by
// cabinet. Both exports take the homConfig/catalog document (see
// scripts/seed-hom-catalog.mjs) as their first argument so the admin's later
// catalog edits flow through with no code change here.
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

function sum(arr) {
  return arr.reduce((s, n) => s + n, 0);
}

// Glass cut size for one shutter — shutter size minus the deduct margin on
// all four sides. Factored out of the per-cabinet costing (which uses it for
// glassArea) so chit-building code (Block 3) can derive the same cut size
// for the glass supplier's chit without re-deriving the formula itself.
export function glassCutSize(shutterW, shutterH, glassDeductMm) {
  const deduct = glassDeductMm || 0;
  return { gW: shutterW - 2 * deduct, gH: shutterH - 2 * deduct };
}

// Deterministic First-Fit-Decreasing bin packing: each piece occupies
// `pieceLength + kerfMm` of a bar's capacity. Returns the number of bars of
// `barLengthMm` needed to hold every piece in `pieces`.
function ffdBarCount(pieces, barLengthMm, kerfMm) {
  const sorted = [...pieces].sort((a, b) => b - a);
  const remaining = [];
  for (const piece of sorted) {
    const need = piece + kerfMm;
    let placedIn = -1;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] >= need) { placedIn = i; break; }
    }
    if (placedIn === -1) {
      remaining.push(barLengthMm - need);
    } else {
      remaining[placedIn] -= need;
    }
  }
  return remaining.length;
}

// Runs the true cutting-stock optimiser for one pooled group of pieces
// against one bar-stock list: tries every AVAILABLE bar length the longest
// piece fits in, FFD-packs the whole group into bars of that length, and
// picks the length with the MINIMUM total cost. `ok: false` (cost 0, label
// "n/a") means no catalog bar can fit the longest piece — the caller must
// surface that as a warning, not silently price the group at a discount.
function packGroup(pieces, bars, kerfMm) {
  if (!pieces.length) return { ok: true, lengthMm: null, label: null, barCount: 0, cost: 0 };

  const longest = Math.max(...pieces);
  let best = null;
  for (const bar of bars || []) {
    if (!bar.available || longest > bar.lengthMm) continue;
    const barCount = ffdBarCount(pieces, bar.lengthMm, kerfMm);
    const cost = barCount * bar.ratePerBar;
    if (!best || cost < best.cost) {
      best = { lengthMm: bar.lengthMm, label: bar.label, barCount, cost };
    }
  }
  return best ? { ok: true, ...best } : { ok: false, lengthMm: null, label: "n/a", barCount: 0, cost: 0 };
}

// Step 1 — piece generation for one cabinet line.
function cabinetPieces(cab) {
  const shutterW = round(cab.cabW / cab.shuttersPerCab);
  const shutterH = cab.cabH;
  const totalShutters = cab.shuttersPerCab * cab.qty;
  const hasHandle = !!cab.fourthSide && cab.fourthSide !== "none";

  const regularPerShutter = hasHandle
    ? [shutterH, shutterW, shutterW]
    : [shutterH, shutterH, shutterW, shutterW];
  const handlePerShutter = hasHandle ? [shutterH] : [];

  const regularPieces = [];
  const handlePieces = [];
  for (let i = 0; i < totalShutters; i++) {
    regularPieces.push(...regularPerShutter);
    handlePieces.push(...handlePerShutter);
  }

  return { shutterW, shutterH, totalShutters, hasHandle, regularPieces, handlePieces };
}

// Prices a full order: pools cut pieces across ALL cabinets into
// brand+profileType+colour (regular) and brand+handleType+colour (handle)
// groups, runs the cutting-stock optimiser once per group, then adds each
// cabinet's exact non-bar costs (glass/hinge/lift-up/making). The order
// total (basic/gst/transport/grand) is the BINDING, exact number. Each
// cabinet also gets an `indicativeTotal` — its exact non-bar costs plus its
// proportional share of the bar cost of the groups it contributed to — for
// DISPLAY only (schedule/chit line items), never re-summed to produce the
// order total.
export function priceOrder(catalog, cabinets) {
  const kerfMm = catalog.kerfMm || 0;

  const regularGroups = new Map();
  const handleGroups = new Map();

  const perCabinet = cabinets.map((cab) => {
    const { shutterW, shutterH, totalShutters, hasHandle, regularPieces, handlePieces } = cabinetPieces(cab);

    const regKey = `${cab.brandId}|${cab.profileTypeId}|${cab.colourId}`;
    if (!regularGroups.has(regKey)) {
      regularGroups.set(regKey, { brandId: cab.brandId, profileTypeId: cab.profileTypeId, colourId: cab.colourId, pieces: [] });
    }
    regularGroups.get(regKey).pieces.push(...regularPieces);

    let handleKey = null;
    if (hasHandle) {
      handleKey = `${cab.brandId}|${cab.fourthSide}|${cab.colourId}`;
      if (!handleGroups.has(handleKey)) {
        handleGroups.set(handleKey, { brandId: cab.brandId, handleTypeId: cab.fourthSide, colourId: cab.colourId, pieces: [] });
      }
      handleGroups.get(handleKey).pieces.push(...handlePieces);
    }

    return {
      shutterW, shutterH, totalShutters, hasHandle, regKey, handleKey,
      regularCutLen: sum(regularPieces),
      handleCutLen: sum(handlePieces),
    };
  });

  // Step 3 — pack every pooled group once.
  let barWarning = false;
  const regularGroupResults = new Map();
  for (const [key, g] of regularGroups) {
    const brand = findById(catalog.brands, g.brandId);
    const packed = packGroup(g.pieces, brand?.regularBars, kerfMm);
    if (!packed.ok) barWarning = true;
    regularGroupResults.set(key, { ...packed, totalLen: sum(g.pieces) });
  }
  const handleGroupResults = new Map();
  for (const [key, g] of handleGroups) {
    const brand = findById(catalog.brands, g.brandId);
    const handleType = brand ? findById(brand.handleTypes, g.handleTypeId) : null;
    const packed = packGroup(g.pieces, handleType?.bars, kerfMm);
    if (!packed.ok) barWarning = true;
    handleGroupResults.set(key, { ...packed, totalLen: sum(g.pieces) });
  }

  const orderBarCost =
    sum([...regularGroupResults.values()].map((r) => r.cost)) +
    sum([...handleGroupResults.values()].map((r) => r.cost));

  // Step 4 — exact per-cabinet non-bar costs.
  let nonBarTotal = 0;
  const pricedCabinets = perCabinet.map((pc, i) => {
    const cab = cabinets[i];

    const glass = findById(catalog.glasses, cab.glassId);
    if (!glass) throw new Error(`Unknown glass id "${cab.glassId}"`);
    const addonRate = (cab.addons || []).reduce((sumRate, addonId) => {
      const addon = findById(catalog.addons, addonId);
      if (!addon) throw new Error(`Unknown addon id "${addonId}"`);
      return sumRate + addon.rate;
    }, 0);
    const { gW, gH } = glassCutSize(pc.shutterW, pc.shutterH, catalog.glassDeductMm);
    const glassArea = round2((gW * gH * pc.totalShutters) / MM2_PER_SQFT);
    const glassRate = glass.rate + addonRate;
    const glassCost = round(glassArea * glassRate);

    const hingeCategory = findById(catalog.hingeCategories, cab.hingeCategoryId);
    if (!hingeCategory) throw new Error(`Unknown hinge category id "${cab.hingeCategoryId}"`);
    const hingeBrand = findById(hingeCategory.brands, cab.hingeBrandId);
    if (!hingeBrand) throw new Error(`Unknown hinge brand id "${cab.hingeBrandId}"`);
    const hingeCost = hingeBrand.rate * cab.hingesPerShutter * pc.totalShutters;

    let hydraulicCost = 0;
    let hydraulicName = null;
    if (cab.liftUp) {
      const hyd = findById(catalog.liftUp?.hydraulicSystems, cab.hydraulicId);
      if (!hyd) throw new Error(`Unknown hydraulic system id "${cab.hydraulicId}"`);
      hydraulicCost = hyd.rate * (catalog.liftUp.qtyPerShutter || 1) * pc.totalShutters;
      hydraulicName = hyd.name;
    }

    const makingCost = catalog.makingPerShutter * pc.totalShutters;
    const nonBarCost = glassCost + hingeCost + hydraulicCost + makingCost;
    nonBarTotal += nonBarCost;

    // Step 5 — DISPLAY-only allocation of this cabinet's group(s)' bar cost,
    // proportional to its share of that group's pooled cut length.
    const regResult = regularGroupResults.get(pc.regKey);
    const regShare = regResult.totalLen > 0 ? pc.regularCutLen / regResult.totalLen : 0;
    const allocatedRegularBarCost = regResult.cost * regShare;

    let allocatedHandleBarCost = 0;
    let handleResult = null;
    if (pc.handleKey) {
      handleResult = handleGroupResults.get(pc.handleKey);
      const handleShare = handleResult.totalLen > 0 ? pc.handleCutLen / handleResult.totalLen : 0;
      allocatedHandleBarCost = handleResult.cost * handleShare;
    }

    const allocatedBarCost = round(allocatedRegularBarCost + allocatedHandleBarCost);
    const indicativeTotal = nonBarCost + allocatedBarCost;

    return {
      ...cab,
      shutterW: pc.shutterW,
      shutterH: pc.shutterH,
      totalShutters: pc.totalShutters,
      glassArea, glassRate, glassCost,
      hingeCost,
      hydraulicCost, hydraulicName,
      makingCost,
      nonBarCost,
      regularBar: { label: regResult.label, lengthMm: regResult.lengthMm, ok: regResult.ok },
      handleBar: handleResult ? { label: handleResult.label, lengthMm: handleResult.lengthMm, ok: handleResult.ok } : null,
      allocatedBarCost,
      indicativeTotal,
    };
  });

  const basic = orderBarCost + nonBarTotal;
  const gst = round(basic * (catalog.gstPct / 100));
  // Flat, order-level, regardless of how many delivery sites the order's
  // cabinets are split across (see homOrder.js's `sites` array) —
  // per-site transport is a future decision, not built here.
  const transport = cabinets.length > 0 ? catalog.transportFlat : 0;
  const grand = basic + gst + transport;

  return {
    basic, gst, transport, grand,
    barCost: orderBarCost,
    nonBarCost: nonBarTotal,
    barWarning,
    cabinets: pricedCabinets,
  };
}

// Standalone single-cabinet estimate for the live "still-being-built"
// preview — reuses priceOrder with a one-cabinet order so the preview is
// computed by the exact same math as the real order (a single-cabinet order
// pools nothing, so its cabinet's indicativeTotal is already exact, not an
// approximation). Label this as indicative in the UI: adding more cabinets
// to the real order can change the pooled bar allocation.
export function estimateCabinet(catalog, cabinetInput) {
  const priced = priceOrder(catalog, [cabinetInput]);
  return { ...priced.cabinets[0], orderBasic: priced.basic, orderGst: priced.gst, orderTransport: priced.transport, orderGrand: priced.grand };
}
