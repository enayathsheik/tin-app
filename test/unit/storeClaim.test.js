import { describe, it, expect } from "vitest";
import {
  buildClaimDoc, cityVariants, isValidGstin, isValidIndianMobile, mergeSearchResults,
  nameVariants, normalisePhone, spellingVariants, validateClaim,
} from "../../src/utils/storeClaim.js";

describe("spelling variants for case-sensitive Firestore search", () => {
  it("covers as-typed, Title Case, UPPER and lower", () => {
    expect(spellingVariants("  sai   tiles ")).toEqual(["sai tiles", "Sai Tiles", "SAI TILES"]);
    expect(nameVariants("Sai Tiles")).toEqual(["Sai Tiles", "SAI TILES", "sai tiles"]);
  });
  it("empty input gives no variants", () => {
    expect(spellingVariants("   ")).toEqual([]);
    expect(cityVariants("")).toEqual([]);
  });
  it("city variants match the imported data's casing and known aliases", () => {
    expect(cityVariants("surat")).toEqual(expect.arrayContaining(["surat", "Surat", "SURAT"]));
    expect(cityVariants("navi mumbai")).toContain("Navi Mumbai");
    expect(cityVariants("Bangalore")).toEqual(expect.arrayContaining(["Bangalore", "Bengaluru", "bengaluru"]));
    expect(cityVariants("Bengaluru").length).toBeLessThanOrEqual(30);
  });
});

describe("phone and GST", () => {
  it("normalises +91 / leading 0 / spaces", () => {
    expect(normalisePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalisePhone("09876543210")).toBe("9876543210");
  });
  it("accepts only Indian mobiles", () => {
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("1876543210")).toBe(false);
    expect(isValidIndianMobile("98765")).toBe(false);
  });
  it("checks the GSTIN pattern", () => {
    expect(isValidGstin("27abcde1234f1z5")).toBe(true);
    expect(isValidGstin("27ABCDE1234F1Z")).toBe(false);
  });
});

describe("validateClaim", () => {
  const ok = { name: "Ramesh", phone: "9876543210", phoneConfirmed: true, gst: "" };
  it("GST is optional", () => {
    expect(validateClaim(ok)).toEqual([]);
  });
  it("needs name, a valid mobile and the confirmation", () => {
    const fields = validateClaim({ name: "", phone: "123", phoneConfirmed: false }).map(e => e.field);
    expect(fields).toEqual(["name", "phone", "phoneConfirmed"]);
  });
  it("rejects a malformed GST when one is given", () => {
    expect(validateClaim({ ...ok, gst: "123" }).map(e => e.field)).toEqual(["gst"]);
  });
});

describe("buildClaimDoc", () => {
  it("builds the exact shape firestore.rules accepts", () => {
    const d = buildClaimDoc({ uid: "u1", email: "u@x.in" }, { id: "s1", storeName: "Sai Tiles", city: "Kalyan" },
      { name: " Ramesh ", phone: "+91 98765 43210", gst: "" });
    expect(d).toEqual({
      claimantUid: "u1", storeId: "s1", storeName: "Sai Tiles", storeCity: "Kalyan", name: "Ramesh",
      phone: "9876543210", phoneConfirmed: true, gst: null, email: "u@x.in", status: "pending",
    });
  });
});

describe("mergeSearchResults", () => {
  it("dedupes by id and sorts by name, case-insensitive", () => {
    const r = mergeSearchResults([[{ id: "b", storeName: "sai b" }, { id: "a", storeName: "Sai A" }], [{ id: "a", storeName: "Sai A" }]]);
    expect(r.map(s => s.id)).toEqual(["a", "b"]);
  });
});
