// AI profile helper, web side (docs/JOBS_BLUEPRINT.md §8): applying the
// server's draft to the editable profile, and the option lists the Cloud
// Function gets (functions/vendor/jobsTaxonomy.json, built from the app's
// taxonomy so they can't drift).
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import process from "process";
import { describe, expect, it } from "vitest";
import { applyDraft, emptyProfile, splitProfile } from "../../src/utils/jobProfile.js";
import * as tax from "../../src/data/jobsTaxonomy.js";

const base = () => ({ ...emptyProfile({ name: "Ramesh", phone: "9876543210", city: "" }), lane: "" });

describe("applyDraft", () => {
  it("fills only what the draft has and lists each filled field as suggested", () => {
    const { next, suggested } = applyDraft(base(), {
      lane: "skilled", role: "Mason", trades: ["mason", "tile_layer"], experienceYears: 5, skills: ["Plaster", "Blockwork"],
      projects: "Plaster for 3 towers in Thane", city: "Thane", areas: "Thane, Navi Mumbai", languages: "Hindi, Marathi",
      workTypePrefs: ["daily_wage"], availability: "immediate", functions: [], education: "", educationText: "", history: [],
    });
    expect(next).toMatchObject({ lane: "skilled", role: "Mason", trades: ["mason", "tile_layer"], experienceYears: "5", skills: "Plaster, Blockwork", city: "Thane", availability: "immediate" });
    expect(suggested.sort()).toEqual(["areas", "availability", "city", "experienceYears", "lane", "languages", "projects", "role", "skills", "trades", "workTypePrefs"].sort());
    expect(next.name).toBe("Ramesh");
    expect(next.phone).toBe("9876543210");
  });

  it("never touches name, phone, email, pay, CV or visibility, even if the draft has them", () => {
    const pr = { ...base(), expectedPay: "₹900 / day", currentPay: "₹800 / day", visibility: "not_discoverable" };
    const { next, suggested } = applyDraft(pr, { name: "X", phone: "1", email: "a@b.c", expectedPay: "1", currentPay: "1", cv: { path: "x" }, visibility: "actively_looking" });
    expect(next).toEqual(pr);
    expect(suggested).toEqual([]);
  });

  it("keeps the lane the candidate already chose", () => {
    const { next, suggested } = applyDraft({ ...base(), lane: "professional" }, { lane: "skilled" });
    expect(next.lane).toBe("professional");
    expect(suggested).not.toContain("lane");
  });

  it("drops anything outside the taxonomy (defence in depth) and survives garbage", () => {
    const { next } = applyDraft(base(), { trades: ["astronaut", "mason"], availability: "tomorrow", experienceYears: 99 });
    expect(next.trades).toEqual(["mason"]);
    expect(next.availability).toBe("");
    expect(next.experienceYears).toBe("");
    for (const junk of [null, undefined, "x", 3, []]) expect(applyDraft(base(), junk).suggested).toEqual([]);
  });

  it("a filled draft saves through the normal split (no private fields on the public doc)", () => {
    const { next } = applyDraft({ ...base(), city: "Thane" }, { lane: "skilled", trades: ["mason"], experienceYears: 5 });
    const { pub } = splitProfile(next);
    expect(pub).toMatchObject({ lane: "skilled", trades: ["mason"], experienceYears: 5 });
    for (const k of ["phone", "email", "currentPay", "expectedPay", "cv"]) expect(pub).not.toHaveProperty(k);
  });
});

describe("functions/vendor/jobsTaxonomy.json", () => {
  it("is generated from src/data/jobsTaxonomy.js with the same keys and labels", () => {
    execFileSync(process.execPath, ["functions/scripts/vendor-ai-foundation.js"], { stdio: "pipe" });
    const json = JSON.parse(readFileSync("functions/vendor/jobsTaxonomy.json", "utf8"));
    for (const list of ["TRADES", "FUNCS", "TYPES", "AVAIL", "EDU", "LANES"]) {
      expect(json[list]).toEqual(tax[list].map(({ key, label, labelHi }) => (labelHi ? { key, label, labelHi } : { key, label })));
    }
    expect(json.SKILLED_WORK_TYPES).toEqual(tax.SKILLED_WORK_TYPES);
  });
});
