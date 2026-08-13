// Pure unit tests for src/utils/homPricing.js — no Firestore/emulator
// involved. Run with `npx vitest run test/unit` (or as part of the full
// `npm run test:rules` run, which includes this path too — see
// vitest.config.js).
import { describe, it, expect } from "vitest";
import { priceCabinet, priceOrder } from "../../src/utils/homPricing.js";

// Same shape as homConfig/catalog (see scripts/seed-hom-catalog.mjs) —
// mirrored here rather than imported so this test doesn't depend on Admin
// SDK / Firestore access.
const catalog = {
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
  glassDeductMm: 0,
  gstPct: 18,
  transportFlat: 300,
};

describe("priceCabinet", () => {
  // KP-WIDE / Brush Gold / GL-01, no addons, handle-less, standard hinge,
  // shuttersPerCab 2, hingesPerShutter 2, cabW 600, cabH 482, qty 1 — the
  // exact case from HOM_Kitchen_Calculator.xlsx.
  it("matches the Excel calculator exactly", () => {
    const result = priceCabinet(catalog, {
      profileId: "KP-WIDE",
      colourId: "col-gold",
      glassId: "GL-01",
      addons: [],
      withHandle: false,
      hingeId: "std",
      shuttersPerCab: 2,
      hingesPerShutter: 2,
      cabW: 600,
      cabH: 482,
      qty: 1,
    });

    expect(result.shutterW).toBe(300);
    expect(result.shutterH).toBe(482);
    expect(result.totalShutters).toBe(2);
    expect(result.glassArea).toBe(3.11);
    expect(result.glassCost).toBe(156);
    expect(result.profileBarsCost).toBe(2400);
    expect(result.barLabel).toBe("10 ft");
    expect(result.handleCost).toBe(0);
    expect(result.hingeCost).toBe(720);
    expect(result.makingCost).toBe(1000);
    expect(result.cabinetTotal).toBe(4276);
  });

  it("cuts the handle length out of the regular cut and prices it separately when withHandle is true", () => {
    const result = priceCabinet(catalog, {
      profileId: "KP-WIDE",
      glassId: "GL-01",
      addons: [],
      withHandle: true,
      hingeId: "std",
      shuttersPerCab: 2,
      hingesPerShutter: 2,
      cabW: 600,
      cabH: 482,
      qty: 1,
    });

    expect(result.handleCut).toBe(2 * 482);
    expect(result.regularCut).toBe(2 * (482 + 2 * 300));
    expect(result.handleCost).toBeGreaterThan(0);
  });

  it("adds selected addon rates onto the base glass rate", () => {
    const withAddon = priceCabinet(catalog, {
      profileId: "KP-WIDE",
      glassId: "GL-01",
      addons: ["GL-ADD01"],
      withHandle: false,
      hingeId: "std",
      shuttersPerCab: 2,
      hingesPerShutter: 2,
      cabW: 600,
      cabH: 482,
      qty: 1,
    });

    expect(withAddon.glassRate).toBe(50 + 225);
  });

  it("flags when no available bar is long enough to fit the cut", () => {
    const result = priceCabinet(catalog, {
      profileId: "KP-WIDE",
      glassId: "GL-01",
      addons: [],
      withHandle: false,
      hingeId: "std",
      shuttersPerCab: 1,
      hingesPerShutter: 2,
      cabW: 5000,
      cabH: 5000,
      qty: 1,
    });

    expect(result.barOk).toBe(false);
    expect(result.barLabel).toBe("n/a");
    expect(result.profileBarsCost).toBe(0);
  });

  it("throws on an unknown glass id rather than silently pricing at zero", () => {
    expect(() =>
      priceCabinet(catalog, {
        profileId: "KP-WIDE",
        glassId: "NOPE",
        hingeId: "std",
        shuttersPerCab: 2,
        cabW: 600,
        cabH: 482,
        qty: 1,
      })
    ).toThrow();
  });
});

describe("priceOrder", () => {
  it("sums cabinet totals into basic/gst/transport/grand", () => {
    const cabinet = {
      profileId: "KP-WIDE",
      glassId: "GL-01",
      addons: [],
      withHandle: false,
      hingeId: "std",
      shuttersPerCab: 2,
      hingesPerShutter: 2,
      cabW: 600,
      cabH: 482,
      qty: 1,
    };

    const order = priceOrder(catalog, [cabinet]);

    expect(order.basic).toBe(4276);
    expect(order.gst).toBeCloseTo(4276 * 0.18, 6);
    expect(order.transport).toBe(300);
    expect(order.grand).toBeCloseTo(4276 + 4276 * 0.18 + 300, 6);
  });

  it("charges no transport for an empty order", () => {
    const order = priceOrder(catalog, []);
    expect(order.basic).toBe(0);
    expect(order.transport).toBe(0);
    expect(order.grand).toBe(0);
  });
});
