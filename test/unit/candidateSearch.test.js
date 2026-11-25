// Find candidates search fields (A1): src/utils/candidateSearch.js and how a
// saved profile carries them.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { EXP_BANDS, LOOKING, cityKey, expBand, isSearchable, searchFields } from "../../src/utils/candidateSearch.js";
import { VISIBILITY } from "../../src/data/jobsTaxonomy.js";
import { applicationSnapshot, emptyProfile, profileFromDocs, splitProfile } from "../../src/utils/jobProfile.js";

describe("cityKey", () => {
  it.each([
    ["Thane", "thane"], ["  THANE ", "thane"], ["Thane (W)", "thane"], ["thane west, Maharashtra", "thane"], ["Thane 400601", "thane"], ["ठाणे", "thane"],
    ["Bangalore", "bengaluru"], ["Bengaluru", "bengaluru"], ["Bombay", "mumbai"], ["मुंबई", "mumbai"], ["Navi Mumbai", "navi mumbai"], ["नवी मुंबई", "navi mumbai"],
    ["New Delhi", "delhi"], ["Gurgaon", "gurugram"], ["गुड़गाँव", "gurugram"], ["Pune/PCMC", "pune"], ["Vasai East", "vasai"], ["Jaipur City", "jaipur"],
    ["Pimpri-Chinchwad", "pimpri chinchwad"], ["St. Thomas Mount", "st thomas mount"], ["लातूर", "लातूर"],
    ["", ""], [null, ""], [undefined, ""], ["400601", ""], ["..", ""], [42, "42"],
  ])("%j → %j", (raw, key) => expect(cityKey(raw)).toBe(key));

  it("both ways of typing ड़ and ज़ give the same key", () => {
    expect(cityKey("गाज़ियाबाद")).toBe("ghaziabad");
    expect(cityKey("गाज़ियाबाद")).toBe("ghaziabad");
  });
  it("is stable (a key maps to itself) and never longer than the rules allow", () => {
    for (const c of ["Thane West", "Bangalore", "Pimpri-Chinchwad", "ठाणे"]) expect(cityKey(cityKey(c))).toBe(cityKey(c));
    expect(cityKey("x".repeat(500)).length).toBe(80);
  });
});

describe("expBand", () => {
  it.each([[0, "0_1"], [1, "0_1"], [1.5, "0_1"], [2, "2_4"], [4.5, "2_4"], [5, "5_9"], [9.9, "5_9"], [10, "10_plus"], [40, "10_plus"], ["3", "2_4"], [null, ""], ["", ""], [undefined, ""], ["abc", ""], [-1, ""]])("%j → %j", (y, b) => expect(expBand(y)).toBe(b));
});

describe("searchable", () => {
  it("needs a clear yes AND a looking visibility", () => {
    for (const { key } of VISIBILITY) {
      expect(isSearchable({ openToEmployers: true, visibility: key })).toBe(!["not_looking", "not_discoverable"].includes(key));
      for (const v of [false, null, undefined, "true", 1]) expect(isSearchable({ openToEmployers: v, visibility: key })).toBe(false);
    }
    expect(isSearchable(null)).toBe(false);
  });
  it("LOOKING and the bands match firestore.rules", () => {
    const rules = readFileSync("firestore.rules", "utf8");
    expect(rules).toContain(`in [${LOOKING.map(k => `"${k}"`).join(", ")}]`);
    expect(rules).toContain(`in ["", ${EXP_BANDS.map(b => `"${b.key}"`).join(", ")}]`);
  });
});

describe("profiles", () => {
  const pr = (extra) => ({ ...emptyProfile(), name: "A", phone: "9000000000", lane: "skilled", trades: ["mason"], city: "Thane West", experienceYears: "6", ...extra });
  it("a new profile is undecided, saves no answer, and is not on search", () => {
    expect(emptyProfile().openToEmployers).toBe(null);
    const { pub } = splitProfile(pr());
    expect(pub).not.toHaveProperty("openToEmployers");
    expect(pub).toMatchObject({ searchable: false, cityKey: "thane", expBand: "5_9" });
  });
  it("an existing profile from before A1 is undecided, not yes", () => {
    const p = profileFromDocs({ name: "A", visibility: "actively_looking" }, {});
    expect([p.openToEmployers, p.openToEmployersSaved]).toEqual([null, null]);
    expect(splitProfile(p).pub.searchable).toBe(false);
  });
  it("yes / no round-trip, and hiding the profile takes it off search", () => {
    for (const v of [true, false]) {
      const { pub, priv } = splitProfile(pr({ openToEmployers: v }));
      expect([pub.openToEmployers, pub.searchable]).toEqual([v, v]);
      expect(profileFromDocs(pub, priv)).toMatchObject({ openToEmployers: v, openToEmployersSaved: v });
    }
    for (const visibility of ["not_looking", "not_discoverable"]) expect(splitProfile(pr({ openToEmployers: true, visibility })).pub).toMatchObject({ openToEmployers: true, searchable: false });
  });
  it("an application never carries the answer or the search fields", () => {
    const text = JSON.stringify(applicationSnapshot(pr({ openToEmployers: true })));
    for (const k of ["openToEmployers", "searchable", "cityKey", "expBand"]) expect(text).not.toContain(k);
  });
  it("backfill input: a doc with no city or experience gives empty fields", () => {
    expect(searchFields({})).toEqual({ cityKey: "", expBand: "" });
    expect(searchFields({ city: "Bangalore", experienceYears: 0 })).toEqual({ cityKey: "bengaluru", expBand: "0_1" });
  });
});
