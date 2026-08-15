// HOM Systems chit builders (Block 3, updated for the rate-list + optimiser
// overhaul) — pure functions, no Firestore. Every number here comes
// straight off the order's FROZEN cabinets[]/catalogSnapshot (written once
// at order-placement time by src/utils/homOrder.js) — never off the live
// homConfig/catalog — so an admin editing today's rates can never
// retroactively change a chit for an order placed yesterday. glassCutSize
// is the one shared formula, imported from homPricing.js rather than
// re-derived here.
import { glassCutSize } from "../../utils/homPricing";

// Mirrors homPricing.js's own cabinetPieces formula exactly (see that
// file): handle-less is 2 regular Height + 2 regular Width per shutter;
// with a fourth side, ONE Height comes from the regular profile and one
// from the handle profile, plus 2 regular Width — this just re-expresses
// the same totals as an itemized piece list for a workshop to actually cut
// against, using the frozen shutterW/shutterH/totalShutters/fourthSide
// fields already on the line, not a re-derivation of the price math.
function cutPieces(line) {
  const hasHandle = !!line.fourthSide && line.fourthSide !== "none";
  const pieces = [];
  if (hasHandle) {
    pieces.push({ label: "Height (handle profile)", lengthMm: line.shutterH, qty: line.totalShutters });
    pieces.push({ label: "Height (regular profile)", lengthMm: line.shutterH, qty: line.totalShutters });
  } else {
    pieces.push({ label: "Height", lengthMm: line.shutterH, qty: line.totalShutters * 2 });
  }
  pieces.push({ label: "Width", lengthMm: line.shutterW, qty: line.totalShutters * 2 });
  return pieces;
}

// Resolves a catalog id to a human-readable name for DISPLAY only — never
// for pricing. `liveCatalog` is today's homConfig/catalog (brand names live
// there; colours/glasses names come off catalogSnapshot below since those
// ARE pricing-relevant and frozen). Falls back to the raw id if the item
// was since removed/renamed, rather than showing nothing.
function nameFrom(list, id) {
  return (list || []).find((item) => item.id === id)?.name || id || "—";
}

function brandName(liveCatalog, brandId) {
  return nameFrom(liveCatalog?.brands, brandId);
}

function profileTypeName(liveCatalog, brandId, profileTypeId) {
  const brand = (liveCatalog?.brands || []).find((b) => b.id === brandId);
  return nameFrom(brand?.profileTypes, profileTypeId);
}

export function buildProductionChit(order, liveCatalog) {
  return {
    orderNo: order.orderNo,
    customerName: order.customer?.name || "",
    cabinets: (order.cabinets || []).map((line, i) => ({
      index: i + 1,
      brandName: brandName(liveCatalog, line.brandId),
      profileName: profileTypeName(liveCatalog, line.brandId, line.profileTypeId),
      colourName: nameFrom(liveCatalog?.colours, line.colourId),
      glassName: nameFrom(order.catalogSnapshot?.glasses, line.glassId),
      shutterSize: `${line.shutterW}×${line.shutterH}mm`,
      totalShutters: line.totalShutters,
      qty: line.qty,
      pieces: cutPieces(line),
      barLabel: line.regularBar?.label,
      barOk: line.regularBar?.ok,
      handleBarLabel: line.handleBar?.label,
      handleBarOk: line.handleBar?.ok,
    })),
  };
}

export function buildProfileChit(order, liveCatalog) {
  return {
    orderNo: order.orderNo,
    lines: (order.cabinets || []).map((line, i) => ({
      index: i + 1,
      brandName: brandName(liveCatalog, line.brandId),
      profileName: profileTypeName(liveCatalog, line.brandId, line.profileTypeId),
      colourName: nameFrom(liveCatalog?.colours, line.colourId),
      pieces: cutPieces(line),
      totalShutters: line.totalShutters,
    })),
  };
}

export function buildGlassChit(order) {
  const glassDeductMm = order.catalogSnapshot?.glassDeductMm || 0;
  return {
    orderNo: order.orderNo,
    lines: (order.cabinets || []).map((line, i) => {
      const { gW, gH } = glassCutSize(line.shutterW, line.shutterH, glassDeductMm);
      const glass = (order.catalogSnapshot?.glasses || []).find((g) => g.id === line.glassId);
      const addonNames = (line.addons || [])
        .map((id) => (order.catalogSnapshot?.addons || []).find((a) => a.id === id)?.name)
        .filter(Boolean);
      return {
        index: i + 1,
        glassName: glass?.name || line.glassId,
        addonNames,
        cutSize: `${gW}×${gH}mm`,
        totalShutters: line.totalShutters,
        glassArea: line.glassArea,
      };
    }),
  };
}

// One label per cabinet line — the closest available notion of "package"
// (nothing elsewhere in the schema models physical packaging granularity).
// Superseded by buildDeliveryChits below (Block 6, multi-site delivery) for
// the admin's actual "Delivery Labels" action, but left exactly as-is —
// still correct for what it does — rather than removed, per this project's
// additive-only convention.
export function buildDeliveryLabels(order) {
  const addr = order.address || {};
  const site = [addr.flat, addr.street, addr.area, addr.city].filter(Boolean).join(", ");
  return (order.cabinets || []).map((line, i) => ({
    index: i + 1,
    packageOf: order.cabinets.length,
    orderNo: order.orderNo,
    customerName: order.customer?.name || "",
    customerPhone: order.customer?.phone || "",
    siteAddress: site,
    pincode: order.customer?.pincode || "",
    shutterSize: `${line.shutterW}×${line.shutterH}mm`,
    totalShutters: line.totalShutters,
    qty: line.qty,
  }));
}

// Block 6 — multi-site delivery: ONE delivery chit PER SITE, each carrying
// only that site's cabinets/packages. Bar pooling/pricing is completely
// unaffected by any of this (see homPricing.js/homOrder.js) — this only
// regroups the ALREADY-PRICED, already-frozen cabinets[] for delivery.
//
// Backward compatibility for orders placed before this field existed (no
// `order.sites` at all, and so no `cabinet.siteId` either): synthesizes a
// single site from the order's pre-existing top-level `address`/
// `customer.pincode` — the exact same fields buildDeliveryLabels above
// already read — so an old order still produces exactly one correct
// delivery chit, not zero and not an error.
export function buildDeliveryChits(order) {
  const cabinets = order.cabinets || [];
  const sites = (order.sites && order.sites.length > 0)
    ? order.sites
    : [{
        siteId: "site-1",
        label: "Site 1",
        address: { ...(order.address || {}), pincode: order.customer?.pincode || "" },
      }];
  // Cabinets written before this field existed have no siteId — they all
  // belong to the one synthesized site above.
  const defaultSiteId = sites[0].siteId;

  return sites.map((site) => {
    const siteCabinets = cabinets.filter((line) => (line.siteId || defaultSiteId) === site.siteId);
    const addr = site.address || {};
    const siteAddress = [addr.flat, addr.street, addr.area, addr.city].filter(Boolean).join(", ");
    return {
      siteId: site.siteId,
      label: site.label,
      orderNo: order.orderNo,
      customerName: order.customer?.name || "",
      customerPhone: order.customer?.phone || "",
      siteAddress,
      pincode: addr.pincode || "",
      packages: siteCabinets.map((line, i) => ({
        index: i + 1,
        packageOf: siteCabinets.length,
        shutterSize: `${line.shutterW}×${line.shutterH}mm`,
        totalShutters: line.totalShutters,
        qty: line.qty,
      })),
    };
  });
}
