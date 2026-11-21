import { describe, it, expect } from "vitest";
import { isStorePublic, isImportedStore } from "../../src/utils/storeVisibility.js";

const imported = { source: "bulk_upload", verificationStatus: "community_added" };

describe("L2 store visibility", () => {
  it("hides an imported, unverified, unclaimed, unlinked store", () => {
    expect(isImportedStore(imported)).toBe(true);
    expect(isStorePublic(imported)).toBe(false);
  });
  it("shows an imported store once verified", () => {
    expect(isStorePublic({ ...imported, verificationStatus: "verified" })).toBe(true);
  });
  it("shows an imported store once a claim is approved", () => {
    expect(isStorePublic({ ...imported, claimedByUid: "u1" })).toBe(true);
  });
  it("shows an imported store linked to an account", () => {
    expect(isStorePublic(imported, { linked: true })).toBe(true);
  });
  it("shows stores that were not bulk-imported", () => {
    expect(isStorePublic({ verificationStatus: "community_added" })).toBe(true);
    expect(isStorePublic({ source: "manual" })).toBe(true);
  });
  it("treats a missing store as not public", () => {
    expect(isStorePublic(null)).toBe(false);
  });
});
