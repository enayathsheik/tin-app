// Pure unit tests for multi-site delivery (Block 6) — resolveSiteLabel
// (src/utils/homOrder.js) and buildDeliveryChits (src/pages/hom/homChits.js).
// No Firestore/emulator involved.
import { describe, it, expect } from "vitest";
import { resolveSiteLabel, DEFAULT_SITE_LABEL } from "../../src/utils/homOrder.js";
import { buildDeliveryChits } from "../../src/pages/hom/homChits.js";

describe("resolveSiteLabel", () => {
  it("returns the trimmed label when one is given", () => {
    expect(resolveSiteLabel("  Kitchen  ")).toBe("Kitchen");
  });

  it("falls back to DEFAULT_SITE_LABEL for blank/whitespace/missing labels", () => {
    expect(resolveSiteLabel("")).toBe(DEFAULT_SITE_LABEL);
    expect(resolveSiteLabel("   ")).toBe(DEFAULT_SITE_LABEL);
    expect(resolveSiteLabel(undefined)).toBe(DEFAULT_SITE_LABEL);
    expect(resolveSiteLabel(null)).toBe(DEFAULT_SITE_LABEL);
  });

  it("is exactly what DEFAULT_SITE_LABEL says — 'Site 1'", () => {
    expect(DEFAULT_SITE_LABEL).toBe("Site 1");
  });
});

// A minimal but realistic order fixture — cabinets already carry the
// computed fields priceOrder/submitHomOrder would have stamped
// (shutterW/shutterH/totalShutters/qty/siteId), since buildDeliveryChits
// reads those, never re-derives them.
function cabinet(siteId, overrides = {}) {
  return {
    siteId,
    shutterW: 300,
    shutterH: 482,
    totalShutters: 2,
    qty: 1,
    ...overrides,
  };
}

describe("buildDeliveryChits — multi-site grouping", () => {
  it("a single-site order produces exactly one chit containing every cabinet", () => {
    const order = {
      orderNo: "HOM-TEST1",
      customer: { name: "Alice", phone: "9998887776" },
      sites: [{ siteId: "Site 1", label: "Site 1", address: { flat: "", street: "", area: "", city: "", pincode: "560001" } }],
      cabinets: [cabinet("Site 1"), cabinet("Site 1")],
    };
    const chits = buildDeliveryChits(order);
    expect(chits).toHaveLength(1);
    expect(chits[0].label).toBe("Site 1");
    expect(chits[0].pincode).toBe("560001");
    expect(chits[0].packages).toHaveLength(2);
    expect(chits[0].packages[0].packageOf).toBe(2);
  });

  it("a two-site order produces two chits, each with only that site's cabinets — none crossed over", () => {
    const order = {
      orderNo: "HOM-TEST2",
      customer: { name: "Bob", phone: "9998887777" },
      sites: [
        { siteId: "Kitchen", label: "Kitchen", address: { flat: "", street: "", area: "", city: "", pincode: "560001" } },
        { siteId: "Utility", label: "Utility", address: { flat: "", street: "", area: "", city: "", pincode: "600001" } },
      ],
      cabinets: [
        cabinet("Kitchen", { shutterW: 300 }),
        cabinet("Kitchen", { shutterW: 300 }),
        cabinet("Utility", { shutterW: 400 }),
      ],
    };
    const chits = buildDeliveryChits(order);
    expect(chits).toHaveLength(2);

    const kitchen = chits.find((c) => c.siteId === "Kitchen");
    const utility = chits.find((c) => c.siteId === "Utility");
    expect(kitchen.packages).toHaveLength(2);
    expect(kitchen.pincode).toBe("560001");
    expect(kitchen.packages.every((p) => p.packageOf === 2)).toBe(true);

    expect(utility.packages).toHaveLength(1);
    expect(utility.pincode).toBe("600001");
    expect(utility.packages[0].packageOf).toBe(1);
  });

  it("cabinets carry the shared order contact (name/phone) on every site's chit", () => {
    const order = {
      orderNo: "HOM-TEST3",
      customer: { name: "Carol", phone: "9998887778" },
      sites: [
        { siteId: "A", label: "Site A", address: { pincode: "560001" } },
        { siteId: "B", label: "Site B", address: { pincode: "560002" } },
      ],
      cabinets: [cabinet("A"), cabinet("B")],
    };
    const chits = buildDeliveryChits(order);
    for (const chit of chits) {
      expect(chit.customerName).toBe("Carol");
      expect(chit.customerPhone).toBe("9998887778");
    }
  });

  it("backward compatibility: an order with no `sites` field synthesizes one site from the legacy top-level address/pincode", () => {
    const order = {
      orderNo: "HOM-OLD1",
      customer: { name: "Legacy Customer", phone: "9998887779", pincode: "560099" },
      address: { flat: "12", street: "Main St", area: "Downtown", city: "Bengaluru" },
      // No `sites`, and cabinets have no `siteId` either — exactly the
      // shape an order written before Block 6 has.
      cabinets: [cabinet(undefined), cabinet(undefined)],
    };
    const chits = buildDeliveryChits(order);
    expect(chits).toHaveLength(1);
    expect(chits[0].pincode).toBe("560099");
    expect(chits[0].siteAddress).toBe("12, Main St, Downtown, Bengaluru");
    expect(chits[0].packages).toHaveLength(2);
  });
});
