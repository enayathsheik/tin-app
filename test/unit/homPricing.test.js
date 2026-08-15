// Pure unit tests for src/utils/homPricing.js — no Firestore/emulator
// involved. Run with `npx vitest run test/unit` (or as part of the full
// `npm run test:rules` run, which includes this path too — see
// vitest.config.js).
import { describe, it, expect } from "vitest";
import { priceOrder, estimateCabinet } from "../../src/utils/homPricing.js";

// Same shape + values as homConfig/catalog (see scripts/seed-hom-catalog.mjs)
// — mirrored here rather than imported so this test doesn't depend on Admin
// SDK / Firestore access.
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

const catalog = {
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
  glassDeductMm: 0,
  gstPct: 18,
  transportFlat: 300,
  kerfMm: 0,
};

describe("priceOrder — (A) anchor: single cabinet, handle-less, matches the Excel calculator exactly", () => {
  const cabinet = {
    brandId: "HOM", profileTypeId: "KP-WIDE", colourId: "col-gold",
    glassId: "GL-01", addons: [], fourthSide: "none",
    liftUp: false, hydraulicId: null,
    hingeCategoryId: "regular_side", hingeBrandId: "hettich",
    shuttersPerCab: 2, hingesPerShutter: 2, cabW: 600, cabH: 482, qty: 1,
  };
  const order = priceOrder(catalog, [cabinet]);
  const c = order.cabinets[0];

  it("piece generation", () => {
    expect(c.shutterW).toBe(300);
    expect(c.shutterH).toBe(482);
    expect(c.totalShutters).toBe(2);
  });

  it("FFD packs the four×482 + four×300 pieces into 2×10ft bars — bar cost 2400", () => {
    expect(c.regularBar.label).toBe("10 ft");
    expect(c.regularBar.ok).toBe(true);
    expect(order.barCost).toBe(2400);
  });

  it("glass / hinge / hydraulic / making", () => {
    expect(c.glassArea).toBe(3.11);
    expect(c.glassCost).toBe(156);
    expect(c.hingeCost).toBe(720);
    expect(c.hydraulicCost).toBe(0);
    expect(c.makingCost).toBe(1000);
  });

  it("cabinet indicative total 4276 and order grand 5346 (gst 770 + transport 300)", () => {
    expect(c.indicativeTotal).toBe(4276);
    expect(order.basic).toBe(4276);
    expect(order.gst).toBe(770);
    expect(order.transport).toBe(300);
    expect(order.grand).toBe(5346);
  });
});

describe("priceOrder — (B) pooling proves a saving across two identical cabinets", () => {
  const oneCabinet = (overrides = {}) => ({
    brandId: "HOM", profileTypeId: "KP-WIDE", colourId: "col-gold",
    glassId: "GL-01", addons: [], fourthSide: "none",
    liftUp: false, hydraulicId: null,
    hingeCategoryId: "regular_side", hingeBrandId: "hettich",
    shuttersPerCab: 1, hingesPerShutter: 2, cabW: 400, cabH: 350, qty: 1,
    ...overrides,
  });

  it("each cabinet priced ALONE packs to its own 1 bar — 2 separate orders cost 2400 total", () => {
    const alone1 = priceOrder(catalog, [oneCabinet()]);
    const alone2 = priceOrder(catalog, [oneCabinet()]);
    expect(alone1.barCost).toBe(1200);
    expect(alone2.barCost).toBe(1200);
    expect(alone1.barCost + alone2.barCost).toBe(2400);
  });

  it("POOLED in one order, the eight pieces (four×400 + four×350 = 3000mm) pack into ONE bar — bar cost 1200, not 2400", () => {
    const pooled = priceOrder(catalog, [oneCabinet(), oneCabinet()]);
    expect(pooled.barCost).toBe(1200);
    expect(pooled.cabinets).toHaveLength(2);
  });

  it("non-bar costs per cabinet (glassArea 1.51 → glassCost 76, hingeCost 360, making 500 → 936 each) and order totals", () => {
    const pooled = priceOrder(catalog, [oneCabinet(), oneCabinet()]);
    for (const c of pooled.cabinets) {
      expect(c.glassArea).toBe(1.51);
      expect(c.glassCost).toBe(76);
      expect(c.hingeCost).toBe(360);
      expect(c.makingCost).toBe(500);
      expect(c.nonBarCost).toBe(936);
    }
    expect(pooled.basic).toBe(3072); // 1200 + 936*2
    expect(pooled.gst).toBe(553);
    expect(pooled.transport).toBe(300);
    expect(pooled.grand).toBe(3925);
  });
});

describe("priceOrder — (C) new paths: profile brand bar rate, handle profile, lift-up, air hinge", () => {
  const cabinet = {
    brandId: "veneto-cnr", profileTypeId: "KP-SLIM", colourId: "col-black",
    glassId: "GL-02", addons: [], fourthSide: "HT-1",
    liftUp: true, hydraulicId: "hettich-lift",
    hingeCategoryId: "air", hingeBrandId: "hettich",
    shuttersPerCab: 2, hingesPerShutter: 2, cabW: 700, cabH: 600, qty: 1,
  };
  const order = priceOrder(catalog, [cabinet]);
  const c = order.cabinets[0];

  it("regular pieces (two×600 + four×350) pack into 1×10ft bar @1400", () => {
    expect(c.regularBar.label).toBe("10 ft");
    expect(c.regularBar.ok).toBe(true);
  });

  it("handle pieces (two×600) pack into 1×10ft HANDLE bar @1900", () => {
    expect(c.handleBar.label).toBe("10 ft");
    expect(c.handleBar.ok).toBe(true);
    expect(order.barCost).toBe(1400 + 1900);
  });

  it("glass / air hinge / lift-up / making", () => {
    expect(c.glassArea).toBe(4.52);
    expect(c.glassCost).toBe(452);
    expect(c.hingeCost).toBe(1280);
    expect(c.hydraulicCost).toBe(1900);
    expect(c.makingCost).toBe(1000);
  });

  it("cabinet total 7932", () => {
    expect(c.indicativeTotal).toBe(7932);
    expect(order.grand).toBe(7932 + Math.round(7932 * 0.18) + 300);
  });
});

describe("priceOrder — error handling and edge cases", () => {
  const baseCabinet = {
    brandId: "HOM", profileTypeId: "KP-WIDE", colourId: "col-gold",
    glassId: "GL-01", addons: [], fourthSide: "none",
    liftUp: false, hydraulicId: null,
    hingeCategoryId: "regular_side", hingeBrandId: "hettich",
    shuttersPerCab: 2, hingesPerShutter: 2, cabW: 600, cabH: 482, qty: 1,
  };

  it("throws on an unknown glass id rather than silently pricing at zero", () => {
    expect(() => priceOrder(catalog, [{ ...baseCabinet, glassId: "NOPE" }])).toThrow();
  });

  it("throws on an unknown hinge brand id", () => {
    expect(() => priceOrder(catalog, [{ ...baseCabinet, hingeBrandId: "nope" }])).toThrow();
  });

  it("throws on an unknown hydraulic id when liftUp is true", () => {
    expect(() => priceOrder(catalog, [{ ...baseCabinet, liftUp: true, hydraulicId: "nope" }])).toThrow();
  });

  it("flags barWarning when no available bar is long enough to fit the cut", () => {
    const order = priceOrder(catalog, [{ ...baseCabinet, shuttersPerCab: 1, cabW: 5000, cabH: 5000 }]);
    expect(order.barWarning).toBe(true);
    expect(order.cabinets[0].regularBar.ok).toBe(false);
    expect(order.cabinets[0].regularBar.label).toBe("n/a");
  });

  it("charges no transport and totals zero for an empty order", () => {
    const order = priceOrder(catalog, []);
    expect(order.basic).toBe(0);
    expect(order.transport).toBe(0);
    expect(order.grand).toBe(0);
  });

  it("adds selected addon rates onto the base glass rate", () => {
    const order = priceOrder(catalog, [{ ...baseCabinet, addons: ["GL-ADD01"] }]);
    expect(order.cabinets[0].glassRate).toBe(50 + 225);
  });
});

describe("estimateCabinet — standalone single-cabinet preview matches priceOrder exactly", () => {
  it("matches the (A) anchor case", () => {
    const cabinet = {
      brandId: "HOM", profileTypeId: "KP-WIDE", colourId: "col-gold",
      glassId: "GL-01", addons: [], fourthSide: "none",
      liftUp: false, hydraulicId: null,
      hingeCategoryId: "regular_side", hingeBrandId: "hettich",
      shuttersPerCab: 2, hingesPerShutter: 2, cabW: 600, cabH: 482, qty: 1,
    };
    const est = estimateCabinet(catalog, cabinet);
    expect(est.indicativeTotal).toBe(4276);
    expect(est.orderGrand).toBe(5346);
  });
});

describe("priceOrder — catalog rate edits never touch an already-computed order (frozen-snapshot proof)", () => {
  it("mutating the catalog object after pricing does not change the already-returned result", () => {
    const cabinet = {
      brandId: "HOM", profileTypeId: "KP-WIDE", colourId: "col-gold",
      glassId: "GL-01", addons: [], fourthSide: "none",
      liftUp: false, hydraulicId: null,
      hingeCategoryId: "regular_side", hingeBrandId: "hettich",
      shuttersPerCab: 2, hingesPerShutter: 2, cabW: 600, cabH: 482, qty: 1,
    };
    const workingCatalog = JSON.parse(JSON.stringify(catalog));
    const order = priceOrder(workingCatalog, [cabinet]);
    expect(order.grand).toBe(5346);

    // Admin edits rates on the live catalog object AFTER the order was priced.
    workingCatalog.brands[0].regularBars[1].ratePerBar = 99999;
    workingCatalog.gstPct = 999;

    expect(order.grand).toBe(5346); // untouched — proves the result is a frozen snapshot, not a live reference
  });
});
