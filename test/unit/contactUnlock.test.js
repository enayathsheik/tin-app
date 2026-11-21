import { describe, it, expect } from "vitest";
import { isContactUnlocked, legacyContactMigration, stageUpdate, unlocksContact } from "../../src/utils/applications.js";

const app = (extra = {}) => ({ id: "j_c", stage: "submitted", stageHistory: [{ stage: "submitted" }], ...extra });
const at = new Date("2026-11-22T10:00:00Z");

describe("L8 contact unlock", () => {
  it("Shortlisted and every later stage unlock; early stages and early rejection don't", () => {
    for (const s of ["shortlisted", "contacted", "int_invited", "int_done", "selected", "offer_sent", "offer_accepted"]) expect(unlocksContact(s)).toBe(true);
    for (const s of ["submitted", "app_viewed", "profile_viewed", "review", "not_shortlisted", "withdrawn", "closed", "not_selected"]) expect(unlocksContact(s)).toBe(false);
  });

  it("the first employer move to Shortlisted records contactUnlockedAt", () => {
    expect(stageUpdate(app(), "shortlisted", "employer", "emp", { at }).contactUnlockedAt).toBe(at);
    expect(stageUpdate(app(), "int_invited", "employer", "emp", { at }).contactUnlockedAt).toBe(at); // straight to interview counts too
  });

  it("no unlock for early stages, candidate moves, or an application already unlocked", () => {
    expect(stageUpdate(app(), "review", "employer", "emp", { at })).not.toHaveProperty("contactUnlockedAt");
    expect(stageUpdate(app({ stage: "int_invited" }), "int_scheduled", "candidate", "c", { at })).not.toHaveProperty("contactUnlockedAt");
    const already = app({ stage: "shortlisted", contactUnlockedAt: new Date() });
    expect(stageUpdate(already, "contacted", "employer", "emp", { at })).not.toHaveProperty("contactUnlockedAt");
  });

  it("unlock is one-way: a later rejection or closing keeps it unlocked", () => {
    expect(isContactUnlocked(app({ stage: "not_selected", contactUnlockedAt: new Date() }))).toBe(true);
    expect(isContactUnlocked(app({ stage: "closed", contactUnlockedAt: new Date() }))).toBe(true);
    expect(isContactUnlocked(app({ stage: "not_shortlisted" }))).toBe(false);
  });

  it("old applications already past Shortlisted count as unlocked (stage or legacy applicantStatus)", () => {
    expect(isContactUnlocked(app({ stage: "int_invited" }))).toBe(true);
    expect(isContactUnlocked({ applicantStatus: "shortlisted" })).toBe(true);
    expect(isContactUnlocked({ applicantStatus: "new" })).toBe(false);
  });
});

describe("L8 migration plan for old applications", () => {
  it("moves contact fields, flags the CV and unlocks only Shortlisted-or-later", () => {
    const plan = legacyContactMigration({ stage: "submitted", applicantPhone: "98", applicantEmail: "", resumePath: "resumes/c/j/cv.pdf", resumeFileName: "cv.pdf" });
    expect(plan.contact).toEqual({ applicantPhone: "98", resumePath: "resumes/c/j/cv.pdf", resumeFileName: "cv.pdf" });
    expect(plan.removeKeys).toEqual(["applicantPhone", "applicantEmail", "resumePath", "resumeFileName"]);
    expect(plan.hasCv).toBe(true);
    expect(plan.unlock).toBe(false);
    expect(legacyContactMigration({ applicantStatus: "shortlisted", applicantPhone: "98" }).unlock).toBe(true);
    expect(legacyContactMigration({ stage: "shortlisted", applicantPhone: "98", contactUnlockedAt: new Date() }).unlock).toBe(false);
  });
  it("nothing to do for applications made after L8", () => {
    expect(legacyContactMigration({ stage: "submitted", hasCv: true })).toBeNull();
  });
});
