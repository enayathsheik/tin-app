// HOM Systems chit builders (Block 3) — pure functions, no Firestore. Every
// number here comes straight off the order's FROZEN cabinets[]/
// catalogSnapshot (written once at order-placement time by
// src/utils/homOrder.js) — never off the live homConfig/catalog — so an
// admin editing today's rates can never retroactively change a chit for an
// order placed yesterday. glassCutSize is the one shared formula, imported
// from homPricing.js rather than re-derived here.
import { glassCutSize } from "../../utils/homPricing";

// The regular/handle cut breakdown mirrors homPricing.js's own regularCut/
// handleCut formulas exactly (see that file) — this just re-expresses the
// same totals as an itemized piece list for a workshop to actually cut
// against, using the same frozen shutterW/shutterH/totalShutters/withHandle
// fields already on the line, not a re-derivation of the price math.
function cutPieces(line) {
  const pieces = [];
  if (line.withHandle) {
    pieces.push({ label: "Height (handle side)", lengthMm: line.shutterH, qty: line.totalShutters });
    pieces.push({ label: "Height (regular)", lengthMm: line.shutterH, qty: line.totalShutters });
  } else {
    pieces.push({ label: "Height", lengthMm: line.shutterH, qty: line.totalShutters * 2 });
  }
  pieces.push({ label: "Width", lengthMm: line.shutterW, qty: line.totalShutters * 2 });
  return pieces;
}

// Resolves a catalog id to a human-readable name for DISPLAY only — never
// for pricing. `liveCatalog` is today's homConfig/catalog (profiles/colours
// aren't in catalogSnapshot — see homOrder.js's freezeCatalogRates comment —
// since nothing in homPricing.js prices off them). Falls back to the raw id
// if the item was since removed/renamed, rather than showing nothing.
function nameFrom(list, id) {
  return (list || []).find((item) => item.id === id)?.name || id || "—";
}

export function buildProductionChit(order, liveCatalog) {
  return {
    orderNo: order.orderNo,
    customerName: order.customer?.name || "",
    cabinets: (order.cabinets || []).map((line, i) => ({
      index: i + 1,
      profileName: nameFrom(liveCatalog?.profiles, line.profileId),
      colourName: nameFrom(liveCatalog?.colours, line.colourId),
      glassName: nameFrom(order.catalogSnapshot?.glasses, line.glassId),
      shutterSize: `${line.shutterW}×${line.shutterH}mm`,
      totalShutters: line.totalShutters,
      qty: line.qty,
      pieces: cutPieces(line),
      barLabel: line.barLabel,
      barOk: line.barOk,
    })),
  };
}

export function buildProfileChit(order, liveCatalog) {
  return {
    orderNo: order.orderNo,
    lines: (order.cabinets || []).map((line, i) => ({
      index: i + 1,
      profileName: nameFrom(liveCatalog?.profiles, line.profileId),
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
