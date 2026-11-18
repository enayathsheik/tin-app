// Pure unit tests for src/lib/submitStore.js — the Add page's save sequence.
// A failed store save must never be reported as added.
import { describe, it, expect, vi } from "vitest";
import { submitStore, storeSaveErrorMessage } from "../../src/lib/submitStore.js";

const fail = (code, message = "boom") => () => Promise.reject(Object.assign(new Error(message), { code }));

describe("submitStore", () => {
  it("success: saves, awards points, then reports the store as added", async () => {
    const order = [];
    const result = await submitStore({
      save: async () => { order.push("save"); return "store123"; },
      awardPoints: async () => { order.push("points"); },
      onSaved: (id) => order.push(`saved:${id}`),
    });
    expect(result).toEqual({ ok: true, id: "store123" });
    expect(order).toEqual(["save", "points", "saved:store123"]);
  });

  it("FAILED SAVE: never reports the store as added and never awards points", async () => {
    const onSaved = vi.fn();
    const awardPoints = vi.fn();
    const result = await submitStore({ save: fail("permission-denied"), awardPoints, onSaved });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission denied/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(awardPoints).not.toHaveBeenCalled();
  });

  it("a points failure after a successful save still counts as added (the store is really saved)", async () => {
    const onSaved = vi.fn();
    const result = await submitStore({ save: async () => "s1", awardPoints: fail("unavailable", "stats down"), onSaved });
    expect(result).toEqual({ ok: true, id: "s1", pointsError: "stats down" });
    expect(onSaved).toHaveBeenCalledWith("s1");
  });

  it("works without a points step (e.g. admin)", async () => {
    const onSaved = vi.fn();
    expect(await submitStore({ save: async () => "s2", awardPoints: null, onSaved })).toEqual({ ok: true, id: "s2" });
    expect(onSaved).toHaveBeenCalledWith("s2");
  });
});

describe("storeSaveErrorMessage", () => {
  it("gives a plain-language reason", () => {
    expect(storeSaveErrorMessage({ code: "permission-denied" })).toMatch(/permission denied/i);
    expect(storeSaveErrorMessage({ code: "unavailable" })).toMatch(/internet connection/i);
    expect(storeSaveErrorMessage({ message: "Failed to fetch: network error" })).toMatch(/internet connection/i);
    expect(storeSaveErrorMessage({ code: "unauthenticated" })).toMatch(/log in again/i);
    expect(storeSaveErrorMessage({ message: "weird" })).toBe("Something went wrong: weird. Please try again.");
    expect(storeSaveErrorMessage(undefined)).toBe("Something went wrong: unknown error. Please try again.");
  });

  it("never says 'saved locally'", () => {
    for (const e of [{ code: "permission-denied" }, { code: "unavailable" }, { message: "x" }]) {
      expect(storeSaveErrorMessage(e)).not.toMatch(/saved locally/i);
    }
  });
});
