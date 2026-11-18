// Pure unit tests for src/data/jobsTaxonomy.js — stable keys, complete
// lifecycle metadata, and internal consistency between the lifecycle lists.
import { describe, it, expect } from "vitest";
import * as T from "../../src/data/jobsTaxonomy.js";

const LISTS = {
  INDUSTRIES: T.INDUSTRIES, FUNCS: T.FUNCS, TYPES: T.TYPES, TRADES: T.TRADES,
  BENEFITS: T.BENEFITS, AVAIL: T.AVAIL, VISIBILITY: T.VISIBILITY, EDU: T.EDU,
  PAY_PERIODS: T.PAY_PERIODS, PAY_DISPLAY: T.PAY_DISPLAY, URGENCY: T.URGENCY, LANES: T.LANES,
};
const SLUG = /^[a-z][a-z0-9_]*$/;

describe("option lists", () => {
  for (const [name, list] of Object.entries(LISTS)) {
    it(`${name}: every option has a slug key and a label, keys and labels unique`, () => {
      expect(list.length).toBeGreaterThan(0);
      for (const o of list) {
        expect(o.key).toMatch(SLUG);
        expect(typeof o.label).toBe("string");
        expect(o.label.length).toBeGreaterThan(0);
      }
      expect(new Set(list.map(o => o.key)).size).toBe(list.length);
      expect(new Set(list.map(o => o.label)).size).toBe(list.length);
    });
  }

  it("list sizes match the prototype", () => {
    expect(T.INDUSTRIES).toHaveLength(11);
    expect(T.FUNCS).toHaveLength(29);
    expect(T.TYPES).toHaveLength(13);
    expect(T.TRADES).toHaveLength(18);
    expect(T.BENEFITS).toHaveLength(17);
    expect(T.AVAIL).toHaveLength(5);
    expect(T.VISIBILITY).toHaveLength(6);
    expect(T.EDU).toHaveLength(5);
    expect(T.PAY_PERIODS).toHaveLength(5);
    expect(T.PAY_DISPLAY).toHaveLength(3);
    expect(T.URGENCY).toHaveLength(3);
  });

  it("every trade has a Hindi label", () => {
    for (const t of T.TRADES) expect(t.labelHi?.length).toBeGreaterThan(0);
  });

  it("every pay period has a suffix", () => {
    for (const p of T.PAY_PERIODS) expect(p.suffix).toMatch(/^\/ /);
  });

  it("SHORT_TYPES are all real work-type keys, no duplicates", () => {
    expect(T.SHORT_TYPES).toHaveLength(6);
    expect(new Set(T.SHORT_TYPES).size).toBe(T.SHORT_TYPES.length);
    for (const k of T.SHORT_TYPES) expect(T.isKey(T.TYPES, k)).toBe(true);
  });
});

describe("application lifecycle", () => {
  const stages = Object.keys(T.ST);

  it("has the 20 prototype stages, all slug keys", () => {
    expect(stages).toHaveLength(20);
    for (const s of stages) expect(s).toMatch(SLUG);
  });

  it("every stage has a label, a known tone, an email flag and candidate text", () => {
    for (const [key, s] of Object.entries(T.ST)) {
      expect(s.label?.length, key).toBeGreaterThan(0);
      expect(Object.keys(T.TONES), key).toContain(s.tone);
      expect(typeof s.email, key).toBe("boolean");
      expect(s.text?.length, key).toBeGreaterThan(0);
    }
  });

  it("stage labels are unique", () => {
    expect(new Set(Object.values(T.ST).map(s => s.label)).size).toBe(stages.length);
  });

  it("FINAL, EMP_SET, BULK_SET, NEXT and MILESTONES only name real stages", () => {
    for (const s of [...T.FINAL, ...T.EMP_SET, ...T.BULK_SET, ...Object.keys(T.NEXT)]) {
      expect(stages).toContain(s);
    }
    for (const [label, ks] of T.MILESTONES) {
      expect(label.length).toBeGreaterThan(0);
      for (const s of ks) expect(stages).toContain(s);
    }
  });

  it("bulk stages are a subset of single-application employer stages", () => {
    for (const s of T.BULK_SET) expect(T.EMP_SET).toContain(s);
  });

  it("every ended-tone stage is final, and final stages have no next step", () => {
    for (const [key, s] of Object.entries(T.ST)) {
      if (s.tone === "e") expect(T.FINAL).toContain(key);
    }
    for (const s of T.FINAL) expect(T.NEXT[s]).toBeUndefined();
  });

  it("every 'next step' stage is an action-needed stage", () => {
    for (const s of Object.keys(T.NEXT)) expect(T.ST[s].tone).toBe("w");
  });
});

describe("helpers", () => {
  it("labelOf / keyForLabel round-trip, exact match only", () => {
    expect(T.labelOf(T.FUNCS, "sales_bd")).toBe("Sales & Business Development");
    expect(T.keyForLabel(T.FUNCS, "Sales & Business Development")).toBe("sales_bd");
    expect(T.keyForLabel(T.FUNCS, "sales & business development")).toBeNull();
    expect(T.labelOf(T.FUNCS, "nope")).toBeNull();
  });

  it("isKey rejects non-strings and unknown keys", () => {
    expect(T.isKey(T.TYPES, "full_time")).toBe(true);
    expect(T.isKey(T.TYPES, "Full-time")).toBe(false);
    expect(T.isKey(T.TYPES, 0)).toBe(false);
    expect(T.isKey(T.TYPES, undefined)).toBe(false);
  });
});
