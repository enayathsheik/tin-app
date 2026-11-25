// Pure unit tests for src/utils/applications.js (stages, milestones, moves)
// and src/utils/jobProfile.js (profile split, apply readiness, snapshot).
import { describe, it, expect } from "vitest";
import {
  candidateActions, canCandidateMoveTo, canEmployerMoveTo, currentStage, employerStageOptions,
  milestoneProgress, shouldMarkViewed, stageUpdate, cleanInterview, interviewComplete,
} from "../../src/utils/applications.js";
import {
  PRIVATE_FIELDS, applicationContact, applicationSnapshot, emptyProfile, isApplyReady, missingForApply, profileFromDocs, splitProfile, tinProfileLines,
} from "../../src/utils/jobProfile.js";
import { phoneToSyntheticEmail } from "../../src/utils/phoneAuth.js";
import { EMP_SET, SKILLED_WORK_TYPES, TYPES, workTypesForLane, isKey } from "../../src/data/jobsTaxonomy.js";

describe("currentStage — new field or the approved legacy mapping", () => {
  it("uses the new stage field when present", () => {
    expect(currentStage({ stage: "shortlisted", applicantStatus: "new" })).toBe("shortlisted");
  });
  it("maps old applicantStatus: new→submitted, shortlisted, rejected→not_shortlisted, hired→offer_accepted", () => {
    expect(currentStage({ applicantStatus: "new" })).toBe("submitted");
    expect(currentStage({ applicantStatus: "shortlisted" })).toBe("shortlisted");
    expect(currentStage({ applicantStatus: "rejected" })).toBe("not_shortlisted");
    expect(currentStage({ applicantStatus: "hired" })).toBe("offer_accepted");
  });
  it("defaults to submitted; ignores unknown stage values", () => {
    expect(currentStage({})).toBe("submitted");
    expect(currentStage({ stage: "made_up" })).toBe("submitted");
  });
});

describe("milestones", () => {
  it("submitted only → first milestone reached and current", () => {
    const { steps, stopped } = milestoneProgress({ stage: "submitted" });
    expect(steps.map(s => s.reached)).toEqual([true, false, false, false, false, false]);
    expect(steps[0].current).toBe(true);
    expect(stopped).toBe(false);
  });
  it("interview scheduled → Submitted, Viewed, Shortlisted, Interview reached (even for an old app with no history)", () => {
    const { steps } = milestoneProgress({ stage: "int_scheduled" });
    expect(steps.map(s => s.reached)).toEqual([true, true, true, true, false, false]);
    expect(steps[3].current).toBe(true);
  });
  it("a closed application greys out (stopped), an accepted offer doesn't", () => {
    expect(milestoneProgress({ stage: "not_shortlisted" }).stopped).toBe(true);
    expect(milestoneProgress({ applicantStatus: "rejected" }).stopped).toBe(true);
    expect(milestoneProgress({ stage: "offer_accepted" }).stopped).toBe(false);
    const h = milestoneProgress({ stage: "hired", stageHistory: [{ stage: "submitted" }, { stage: "selected" }, { stage: "hired" }] });
    expect([h.stopped, h.steps[5].label, h.steps[5].reached, h.steps[5].current]).toEqual([false, "Hired", true, true]);
    expect(milestoneProgress({ stage: "selected" }).steps[5].label).toBe("Offer");
    expect(candidateActions({ stage: "hired" })).toEqual({ withdraw: false, acceptInterview: false, requestReschedule: false, answerOffer: false });
    expect(canCandidateMoveTo({ stage: "offer_sent" }, "hired")).toBe(false);
    for (const [s, ok] of [["selected", true], ["offer_sent", true], ["int_done", false], ["shortlisted", false], ["hired", false], ["withdrawn", false]]) expect(canEmployerMoveTo({ stage: s }, "hired")).toBe(ok);
  });
  it("uses the history to show what was reached before a closing stage", () => {
    const app = { stage: "not_selected", stageHistory: [{ stage: "submitted" }, { stage: "app_viewed" }, { stage: "shortlisted" }, { stage: "int_invited" }, { stage: "not_selected" }] };
    expect(milestoneProgress(app).steps.map(s => s.reached)).toEqual([true, true, true, true, false, false]);
  });
});

describe("candidate moves (blueprint §4.4)", () => {
  it("withdraw any time before the application is closed", () => {
    expect(canCandidateMoveTo({ stage: "submitted" }, "withdrawn")).toBe(true);
    expect(canCandidateMoveTo({ stage: "not_selected" }, "withdrawn")).toBe(false);
  });
  it("accept an interview only from invited / rescheduled", () => {
    expect(canCandidateMoveTo({ stage: "int_invited" }, "int_scheduled")).toBe(true);
    expect(canCandidateMoveTo({ stage: "int_rescheduled" }, "int_scheduled")).toBe(true);
    expect(canCandidateMoveTo({ stage: "shortlisted" }, "int_scheduled")).toBe(false);
  });
  it("answer an offer only from offer_sent", () => {
    expect(canCandidateMoveTo({ stage: "offer_sent" }, "offer_accepted")).toBe(true);
    expect(canCandidateMoveTo({ stage: "selected" }, "offer_accepted")).toBe(false);
  });
  it("can't move to employer stages", () => {
    expect(canCandidateMoveTo({ stage: "submitted" }, "shortlisted")).toBe(false);
  });
  it("candidateActions reflect the stage", () => {
    expect(candidateActions({ stage: "int_invited" })).toEqual({ withdraw: true, acceptInterview: true, requestReschedule: true, answerOffer: false });
    expect(candidateActions({ stage: "offer_sent" }).answerOffer).toBe(true);
    expect(candidateActions({ stage: "withdrawn" })).toEqual({ withdraw: false, acceptInterview: false, requestReschedule: false, answerOffer: false });
  });
});

describe("employer moves", () => {
  it("EMP_SET options minus the current stage; none once closed", () => {
    expect(employerStageOptions({ stage: "review" })).toEqual(EMP_SET.filter(s => s !== "review" && s !== "hired"));
    expect(employerStageOptions({ stage: "offer_sent" })).toContain("hired");
    expect(employerStageOptions({ stage: "closed" })).toEqual([]);
  });
  it("employer stages include viewed + interview invite/reschedule, not candidate stages", () => {
    expect(canEmployerMoveTo({ stage: "submitted" }, "app_viewed")).toBe(true);
    expect(canEmployerMoveTo({ stage: "shortlisted" }, "int_invited")).toBe(true);
    expect(canEmployerMoveTo({ stage: "offer_sent" }, "offer_accepted")).toBe(false);
    expect(canEmployerMoveTo({ stage: "withdrawn" }, "review")).toBe(false);
  });
  it("opening marks 'viewed' only while still submitted (incl. old 'new')", () => {
    expect(shouldMarkViewed({ stage: "submitted" })).toBe(true);
    expect(shouldMarkViewed({ applicantStatus: "new" })).toBe(true);
    expect(shouldMarkViewed({ stage: "app_viewed" })).toBe(false);
  });
});

describe("stageUpdate", () => {
  it("appends exactly one history entry, with an optional trimmed note", () => {
    const at = new Date("2026-11-18T10:00:00Z");
    const u = stageUpdate({ stageHistory: [{ stage: "submitted" }] }, "shortlisted", "employer", "e1", { note: "  Good fit ", at });
    expect(u.stage).toBe("shortlisted");
    expect(u.stageHistory).toHaveLength(2);
    expect(u.stageHistory[1]).toEqual({ stage: "shortlisted", at, by: "employer", byUid: "e1", note: "Good fit" });
  });
  it("works on an old application with no history", () => {
    expect(stageUpdate({ applicantStatus: "new" }, "app_viewed", "employer", "e1").stageHistory).toHaveLength(1);
  });
  it("adds interview details when given", () => {
    expect(stageUpdate({}, "int_invited", "employer", "e1", { interview: { date: "2026-11-25" } }).interview).toEqual({ date: "2026-11-25" });
  });
});

describe("interview details", () => {
  it("in-person needs a place; phone/video don't", () => {
    expect(interviewComplete(cleanInterview({ date: "2026-11-25", time: "11:00", mode: "In person" }))).toBe(false);
    expect(interviewComplete(cleanInterview({ date: "2026-11-25", time: "11:00", mode: "In person", where: "Shop 4" }))).toBe(true);
    expect(interviewComplete(cleanInterview({ date: "2026-11-25", time: "11:00", mode: "Phone call" }))).toBe(true);
    expect(cleanInterview({ mode: "Hologram" }).mode).toBe("In person");
  });
});

describe("work types per lane (owner decision)", () => {
  it("skilled sees only its 6 types; professional sees all", () => {
    expect(workTypesForLane("skilled").map(t => t.key).sort()).toEqual([...SKILLED_WORK_TYPES].sort());
    expect(workTypesForLane("professional")).toHaveLength(TYPES.length);
    for (const k of SKILLED_WORK_TYPES) expect(isKey(TYPES, k)).toBe(true);
  });
});

describe("job profile", () => {
  const full = () => ({
    ...emptyProfile(), name: "Prakash More", phone: "9769031000", email: "p@example.com", lane: "skilled",
    trades: ["mason", "made_up"], experienceYears: "12", languages: "Marathi, Hindi", projects: "Plaster for 3 towers",
    city: "Thane", areas: "Thane, Navi Mumbai", workTypePrefs: ["daily_wage", "nope"], expectedPay: "₹950 / day", currentPay: "₹800 / day",
    availability: "immediate", visibility: "actively_looking", skills: "Blockwork, Plaster,",
  });

  it("splitProfile keeps phone, email and pay OFF the shareable doc", () => {
    const { pub, priv } = splitProfile(full());
    for (const k of PRIVATE_FIELDS) expect(pub).not.toHaveProperty(k);
    expect(priv).toEqual({ phone: "9769031000", email: "p@example.com", expectedPay: "₹950 / day", currentPay: "₹800 / day", showPayToEmployers: false });
    expect(pub.trades).toEqual(["mason"]);
    expect(pub.workTypePrefs).toEqual(["daily_wage"]);
    expect(pub.experienceYears).toBe(12);
    expect(pub.skills).toEqual(["Blockwork", "Plaster"]);
  });

  it("defaults visibility to 'Open to opportunities'", () => {
    expect(splitProfile({ ...full(), visibility: "" }).pub.visibility).toBe("open_to_opportunities");
    expect(emptyProfile().visibility).toBe("open_to_opportunities");
  });

  it("round-trips through the two docs", () => {
    const { pub, priv } = splitProfile(full());
    const back = profileFromDocs(pub, priv);
    expect(back.trades).toEqual(["mason"]);
    expect(back.phone).toBe("9769031000");
    expect(back.exists).toBe(true);
  });

  it("apply needs only name, 10-digit mobile, trade (skilled) or role (professional), and city", () => {
    expect(isApplyReady(full(), "skilled")).toBe(true);
    expect(missingForApply({ ...emptyProfile(), name: "A", phone: "98", city: "" }, "skilled")).toEqual(["phone", "trades", "city"]);
    expect(missingForApply({ ...emptyProfile(), name: "A", phone: "9876543210", city: "Pune", role: "" }, "professional")).toEqual(["role"]);
    expect(isApplyReady({ ...emptyProfile(), name: "A", phone: "98765 43210", city: "Pune", role: "Sales" }, "professional")).toBe(true);
  });

  it("L8: the application the employer reads has NO phone, email or pay by default", () => {
    const snap = applicationSnapshot(full());
    expect(snap.applicantName).toBe("Prakash More");
    for (const k of ["applicantPhone", "applicantEmail", "expectedPay", "currentPay", "resumePath"]) expect(snap).not.toHaveProperty(k);
    expect(JSON.stringify(snap)).not.toMatch(/9769031000|p@example|950|800/);
    expect(snap.payVisible).toBe(false);
    expect(snap.profileSnapshot.trades).toEqual(["mason"]);
  });

  it("L8: with \"show my pay\" on, expected and current pay go in; contact still doesn't", () => {
    const snap = applicationSnapshot({ ...full(), showPayToEmployers: true });
    expect(snap).toMatchObject({ payVisible: true, expectedPay: "₹950 / day", currentPay: "₹800 / day" });
    expect(snap).not.toHaveProperty("applicantPhone");
  });

  it("L8: phone and email go to the private contact part", () => {
    expect(applicationContact(full())).toEqual({ applicantPhone: "9769031000", applicantEmail: "p@example.com" });
  });

  it("TIN Profile lines show trades in English + Hindi and only what's filled in", () => {
    const lines = Object.fromEntries(tinProfileLines(applicationSnapshot(full()).profileSnapshot));
    expect(lines.Trades).toBe("Mason (राजमिस्त्री)");
    expect(lines.Experience).toBe("12 years");
    expect(lines["Work done"]).toBe("Plaster for 3 towers");
    expect(lines.Available).toBe("Immediate");
    expect(tinProfileLines({})).toEqual([]);
  });

  it("never prefills the internal phone-account email, but keeps a real one", () => {
    expect(emptyProfile({ email: phoneToSyntheticEmail("9876543210") }).email).toBe("");
    expect(emptyProfile({ email: "real@example.com" }).email).toBe("real@example.com");
  });
});
