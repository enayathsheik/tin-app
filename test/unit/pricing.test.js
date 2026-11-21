import { describe, it, expect } from "vitest";
import {
  DEFAULT_FEE, ENTITLEMENT_DAYS, entitlementDoc, entitlementId, feeNow, priceDisplay, pricingFrom, validUntilFrom, validatePricing,
} from "../../src/utils/pricing.js";

describe("L9 pricing", () => {
  it("defaults: list ₹750, offer ₹100, launch discount ON, shortlist limit 10", () => {
    const p = pricingFrom(null);
    expect(p.profileFee).toEqual(DEFAULT_FEE);
    expect(p.jobPostFee).toEqual({ list: 750, offer: 100, launchDiscount: true });
    expect(p.shortlistLimit).toBe(10);
  });
  it("fills gaps in a partial config", () => {
    const p = pricingFrom({ profileFee: { list: 500 }, shortlistLimit: 15 });
    expect(p.profileFee).toEqual({ list: 500, offer: 100, launchDiscount: true });
    expect(p.shortlistLimit).toBe(15);
  });
  it("launch discount ON = ₹0, shown as 'Free during launch' with the list price struck out", () => {
    expect(feeNow({ list: 750, offer: 100, launchDiscount: true })).toBe(0);
    expect(priceDisplay({ list: 750, offer: 100, launchDiscount: true })).toEqual({ struck: 750, now: 0, label: "Free during launch" });
  });
  it("launch discount OFF = the offer price, list price struck out", () => {
    expect(priceDisplay({ list: 750, offer: 100, launchDiscount: false })).toEqual({ struck: 750, now: 100, label: "₹100" });
    expect(priceDisplay({ list: 100, offer: 100, launchDiscount: false }).struck).toBeNull();
  });
  it("admin form validation", () => {
    const ok = { profileFee: { list: 750, offer: 100, launchDiscount: true }, jobPostFee: { list: "750", offer: "100", launchDiscount: false }, shortlistLimit: "10" };
    expect(validatePricing(ok)).toEqual([]);
    const bad = validatePricing({ profileFee: { list: -1, offer: 100 }, jobPostFee: { list: 100, offer: 200 }, shortlistLimit: 0 }).map(e => e.field);
    expect(bad).toEqual(["profileFee.list", "jobPostFee.offer", "shortlistLimit"]);
    expect(validatePricing({ ...ok, shortlistLimit: 1000 }).map(e => e.field)).toEqual(["shortlistLimit"]);
  });
  it("entitlement: 365 days, price snapshot, nothing paid", () => {
    expect(ENTITLEMENT_DAYS).toBe(365);
    expect(entitlementId("job_post", "abc")).toBe("job_post_abc");
    expect(entitlementDoc("job_profile", "u1", "u1", { list: 750, offer: 100, launchDiscount: true })).toEqual({
      uid: "u1", kind: "job_profile", refId: "u1", priceList: 750, priceOffer: 100, launchDiscount: true, pricePaid: 0, reason: "launch_discount",
    });
    expect(entitlementDoc("job_post", "u1", "j1", { list: 750, offer: 100, launchDiscount: false }).reason).toBe("payments_not_live");
    const start = new Date("2026-11-22T00:00:00Z");
    expect(validUntilFrom(start).toISOString()).toBe("2027-11-22T00:00:00.000Z");
  });
});
