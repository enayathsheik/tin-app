import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHORTLIST_LIMIT, SHORTLIST_FULL_MESSAGE, ShortlistFullError, isShortlistFull, planShortlistSlots,
  shortlistCountOf, shortlistLimitFrom, shortlistsLeft,
} from "../../src/utils/shortlist.js";

describe("L10 shortlist limit helpers", () => {
  it("default limit is 10; admin config overrides with a positive whole number", () => {
    expect(DEFAULT_SHORTLIST_LIMIT).toBe(10);
    expect(shortlistLimitFrom(null)).toBe(10);
    expect(shortlistLimitFrom({ shortlistLimit: 15 })).toBe(15);
    expect(shortlistLimitFrom({ shortlistLimit: 0 })).toBe(10);
    expect(shortlistLimitFrom({ shortlistLimit: "x" })).toBe(10);
  });
  it("reads the count from a raw or normalised job", () => {
    expect(shortlistCountOf({ shortlistCount: 7 })).toBe(7);
    expect(shortlistCountOf({ raw: { shortlistCount: 3 } })).toBe(3);
    expect(shortlistCountOf({})).toBe(0);
  });
  it("left / full", () => {
    expect(shortlistsLeft({ shortlistCount: 7 }, 10)).toBe(3);
    expect(isShortlistFull({ shortlistCount: 10 }, 10)).toBe(true);
    expect(isShortlistFull({ shortlistCount: 12 }, 10)).toBe(true);
  });
  it("the at-limit message is the owner's text", () => {
    expect(SHORTLIST_FULL_MESSAGE(10)).toBe("You've used all 10 shortlists for this job. Post another job to shortlist more.");
    expect(new ShortlistFullError(10).message).toBe(SHORTLIST_FULL_MESSAGE(10));
  });
  it("bulk: only first-time shortlists need a slot; extras over the limit are skipped", () => {
    const u = (id, unlock) => ({ app: { id }, update: unlock ? { contactUnlockedAt: new Date() } : {} });
    const plan = planShortlistSlots([u("a", true), u("b", false), u("c", true), u("d", true)], { count: 8, limit: 10 });
    expect(plan.slotted.map(x => x.app.id)).toEqual(["a", "c"]);
    expect(plan.normal.map(x => x.app.id)).toEqual(["b"]);
    expect(plan.overLimit.map(x => x.app.id)).toEqual(["d"]);
    expect(planShortlistSlots([u("a", true)], { count: 10, limit: 10 }).overLimit).toHaveLength(1);
  });
});
