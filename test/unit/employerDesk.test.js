import { describe, expect, it } from "vitest";
import { CONTACT_UNLOCK_STAGES, EMP_SET, ST } from "../../src/data/jobsTaxonomy.js";
import { stageText } from "../../src/utils/applications.js";
import {
  BOARD_COLUMNS, bulkPlan, closePlan, columnOf, defaultNote, deskCounts, groupByColumn, isInterviewThisWeek,
  isPeopleBucket, isToReply, moveOptions, nextAction, peopleCounts, peopleIn, peopleLine, PEOPLE_BUCKETS, POLITE_NOTES, vacancyTab, weekRange,
} from "../../src/utils/employerDesk.js";

const app = (stage, extra = {}) => ({ id: stage + Math.random(), stage, stageHistory: [], ...extra });

describe("pipeline board", () => {
  it("every stage belongs to exactly one column", () => {
    for (const s of Object.keys(ST)) {
      expect(BOARD_COLUMNS.filter(c => c.stages.includes(s))).toHaveLength(1);
    }
    expect(BOARD_COLUMNS.map(c => c.label)).toEqual(["New", "Viewed", "Shortlisted / Contacted", "Interview", "Selected / Offer", "Closed"]);
  });

  it("legacy applications (no stage) land by their old status", () => {
    expect(columnOf("submitted")).toBe("new");
    const g = groupByColumn([{ applicantStatus: "new" }, { applicantStatus: "rejected" }, { applicantStatus: "hired" }]);
    expect(g.new).toHaveLength(1);
    expect(g.closed).toHaveLength(1);
    expect(g.offer).toHaveLength(1); // hired → offer_accepted
  });
});

describe("moves", () => {
  it("Not shortlisted only before the interview, Not selected only from it on", () => {
    expect(moveOptions(app("app_viewed"))).toContain("not_shortlisted");
    expect(moveOptions(app("app_viewed"))).not.toContain("not_selected");
    expect(moveOptions(app("int_done"))).toContain("not_selected");
    expect(moveOptions(app("int_done"))).not.toContain("not_shortlisted");
  });

  it("only employer stages, never the current one, nothing once closed", () => {
    const opts = moveOptions(app("shortlisted"));
    expect(opts.every(s => EMP_SET.includes(s))).toBe(true);
    expect(opts).not.toContain("shortlisted");
    expect(moveOptions(app("withdrawn"))).toEqual([]);
    expect(moveOptions(app("offer_accepted"))).toEqual([]);
  });

  it("next step per stage", () => {
    expect(nextAction(app("submitted"))).toEqual({ stage: "shortlisted", label: "Shortlist" });
    expect(nextAction(app("shortlisted")).action).toBe("invite");
    expect(nextAction(app("int_scheduled")).stage).toBe("int_done");
    expect(nextAction(app("int_done")).stage).toBe("selected");
    expect(nextAction(app("selected")).stage).toBe("offer_sent");
    expect(nextAction(app("int_invited"))).toBeNull(); // waiting on the candidate
    expect(nextAction(app("closed"))).toBeNull();
  });
});

describe("desk numbers", () => {
  const wed = new Date(2026, 10, 18); // Wed 18 Nov 2026

  it("week = Monday to Sunday", () => {
    expect(weekRange(wed)).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(weekRange(new Date(2026, 10, 22))).toEqual({ start: "2026-11-16", end: "2026-11-22" }); // Sunday
    expect(weekRange(new Date(2026, 10, 23))).toEqual({ start: "2026-11-23", end: "2026-11-29" }); // Monday
  });

  it("interviews this week: interview stages with a date in the week", () => {
    expect(isInterviewThisWeek(app("int_scheduled", { interview: { date: "2026-11-20" } }), wed)).toBe(true);
    expect(isInterviewThisWeek(app("int_invited", { interview: { date: "2026-11-16" } }), wed)).toBe(true);
    expect(isInterviewThisWeek(app("int_scheduled", { interview: { date: "2026-11-23" } }), wed)).toBe(false);
    expect(isInterviewThisWeek(app("int_done", { interview: { date: "2026-11-18" } }), wed)).toBe(false);
    expect(isInterviewThisWeek(app("int_scheduled"), wed)).toBe(false);
  });

  it("to reply = reschedule requests + confirmed interviews awaiting 'Interview done'", () => {
    expect(isToReply(app("int_scheduled"))).toBe(true);
    expect(isToReply(app("int_invited", { interviewResponse: { type: "reschedule_request" } }))).toBe(true);
    expect(isToReply(app("int_rescheduled", { interviewResponse: { type: "reschedule_request" } }))).toBe(true);
    expect(isToReply(app("int_invited"))).toBe(false);
    expect(isToReply(app("int_done"))).toBe(false);
    expect(isToReply(app("submitted"))).toBe(false);
  });

  it("counts open jobs, new applicants, interviews this week, to reply", () => {
    const jobs = [
      { id: "a", status: "approved", jobStatus: "live" },
      { id: "b", status: "approved" }, // legacy: no jobStatus = live
      { id: "c", status: "approved", jobStatus: "paused" },
      { id: "d", status: "pending", jobStatus: "live" },
      { id: "e", status: "approved", jobStatus: "closed" },
    ];
    const appsByJob = {
      a: [app("submitted"), app("int_scheduled", { interview: { date: "2026-11-19" } })],
      b: [{ applicantStatus: "new" }, app("int_invited", { interviewResponse: { type: "reschedule_request" }, interview: { date: "2026-12-01" } })],
    };
    expect(deskCounts(jobs, appsByJob, wed)).toEqual({ openJobs: 2, newApplicants: 2, interviewsThisWeek: 1, toReply: 2 });
  });

  it("vacancy tab from jobStatus (missing = live)", () => {
    expect(vacancyTab({})).toBe("live");
    expect(vacancyTab({ jobStatus: "paused" })).toBe("paused");
    expect(vacancyTab({ jobStatus: "filled" })).toBe("filled");
    expect(vacancyTab({ jobStatus: "closed" })).toBe("closed");
  });
});

describe("polite notes", () => {
  it("English for professional jobs, English + Hindi for skilled jobs", () => {
    expect(defaultNote("not_shortlisted", "professional")).toBe(POLITE_NOTES.reject.en);
    expect(defaultNote("not_selected", "skilled")).toBe(`${POLITE_NOTES.reject.en}\n${POLITE_NOTES.reject.hi}`);
    expect(defaultNote("closed", "skilled")).toContain("यह पद अब बंद हो गया है।");
    expect(defaultNote("shortlisted", "skilled")).toBe("");
  });
});

describe("bulk updates", () => {
  it("skips closed, already-there and not-fitting applications", () => {
    const apps = [app("submitted"), app("app_viewed"), app("not_selected"), app("withdrawn"), app("not_shortlisted"), app("int_done")];
    const p = bulkPlan(apps, "not_shortlisted");
    expect(p.update.map(a => a.stage)).toEqual(["submitted", "app_viewed"]);
    expect(p.skipped).toEqual({ closed: 3, same: 0, notFitting: 1 });
  });

  it("only BULK_SET stages", () => {
    expect(bulkPlan([app("submitted")], "offer_sent").invalid).toBe(true);
    expect(bulkPlan([app("submitted")], "offer_sent").update).toEqual([]);
    expect(bulkPlan([app("review")], "review").skipped.same).toBe(1);
  });
});

describe("closing a vacancy", () => {
  const apps = [app("submitted"), app("int_scheduled"), app("selected"), app("offer_sent"), app("offer_accepted"), app("withdrawn")];

  it("Filled keeps Selected / Offer sent / Offer accepted and counts pending offers", () => {
    const p = closePlan(apps, "filled");
    expect(p.close.map(a => a.stage)).toEqual(["submitted", "int_scheduled"]);
    expect(p.kept.map(a => a.stage)).toEqual(["selected", "offer_sent", "offer_accepted"]);
    // marked as hired: kept too, and not a pending offer
    const h = closePlan([...apps, app("hired")], "filled");
    expect([h.kept.length, h.pendingOffers]).toEqual([4, p.pendingOffers]);
    expect(closePlan([app("hired")], "closed").close).toEqual([]);
    expect(p.pendingOffers).toBe(2);
    expect(p.alreadyClosed).toBe(1);
  });

  it("Closed (no hire) ends every open application", () => {
    const p = closePlan(apps, "closed");
    expect(p.close.map(a => a.stage)).toEqual(["submitted", "int_scheduled", "selected", "offer_sent"]);
    expect(p.kept).toEqual([]);
    expect(p.alreadyClosed).toBe(2);
  });
});

describe("people counts and lists (C)", () => {
  it("only stages where contact is unlocked, each in one bucket; every one but Offer Declined has a place", () => {
    const all = PEOPLE_BUCKETS.flatMap(b => b.stages);
    expect(new Set(all).size).toBe(all.length);
    for (const s of all) expect(CONTACT_UNLOCK_STAGES).toContain(s);
    expect(CONTACT_UNLOCK_STAGES.filter(s => !all.includes(s))).toEqual(["offer_declined"]);
    expect(PEOPLE_BUCKETS.map(b => b.label)).toEqual(["Shortlisted", "Contacted", "Interviews", "Offers", "Hired"]);
  });
  it("counts where people are now: moving on leaves the old bucket; rejected, withdrawn and closed are in none", () => {
    const apps = ["submitted", "app_viewed", "review", "shortlisted", "info_req", "contacted", "int_invited", "int_scheduled", "int_rescheduled", "int_done", "selected", "offer_sent", "offer_accepted", "offer_declined", "not_shortlisted", "not_selected", "withdrawn", "closed"].map(s => app(s, { contactUnlockedAt: 1 }));
    expect(peopleCounts(apps)).toEqual({ shortlisted: 2, contacted: 1, interview: 4, offer: 2, hired: 1 });
    expect(peopleCounts([])).toEqual({ shortlisted: 0, contacted: 0, interview: 0, offer: 0, hired: 0 });
    expect(peopleCounts(undefined).hired).toBe(0);
  });
  it("marked as hired counts as Hired", () => {
    expect(peopleCounts([app("hired"), app("offer_accepted")]).hired).toBe(2);
    expect(columnOf("hired")).toBe("offer");
  });
  it("hired is offered only to people selected or offered", () => {
    for (const s of Object.keys(ST)) expect([s, moveOptions(app(s)).includes("hired")]).toEqual([s, ["selected", "offer_sent"].includes(s)]);
    expect(moveOptions(app("hired"))).toEqual([]);
    expect(bulkPlan([app("selected")], "hired").invalid).toBe(true);
  });
  it("older applications (no stage) count by their old status", () => {
    expect(peopleCounts([{ applicantStatus: "shortlisted" }, { applicantStatus: "hired" }, { applicantStatus: "new" }, { applicantStatus: "rejected" }])).toEqual({ shortlisted: 1, contacted: 0, interview: 0, offer: 0, hired: 1 });
  });
  it("lists: latest change first; interviews soonest first, done last", () => {
    const t = (n) => ({ updatedAt: { seconds: n } });
    expect(peopleIn([app("shortlisted", { id: "a", ...t(1) }), app("shortlisted", { id: "b", ...t(9) }), app("contacted", { id: "c" })], "shortlisted").map(x => x.id)).toEqual(["b", "a"]);
    const iv = [app("int_done", { id: "done", interview: { date: "2026-11-01" }, ...t(99) }), app("int_scheduled", { id: "late", interview: { date: "2026-12-02", time: "10:00" } }), app("int_invited", { id: "soon", interview: { date: "2026-11-30", time: "09:00" } }), app("int_invited", { id: "nodate" })];
    expect(peopleIn(iv, "interview").map(x => x.id)).toEqual(["soon", "late", "done", "nodate"]);
    expect(peopleIn(iv, "made_up")).toEqual([]);
  });
  it("the line on a job card shows only what isn't zero", () => {
    expect(peopleLine([app("shortlisted"), app("shortlisted"), app("int_done"), app("submitted")])).toBe("Shortlisted 2 · Interviews 1");
    expect(peopleLine([app("submitted")])).toBe("");
  });
  it("only real buckets are accepted from the address bar", () => {
    expect(["shortlisted", "hired", "", null, "x"].map(isPeopleBucket)).toEqual([true, true, false, false, false]);
  });
});

describe("someone found in search isn't thanked for applying", () => {
  const found = { source: "employer_search" };
  it("notes", () => {
    expect(defaultNote("not_shortlisted", "skilled", found)).not.toMatch(/applying|आवेदन/);
    expect(defaultNote("not_selected", "professional", [{}, found])).toContain("Thank you for your time.");
    expect(defaultNote("not_shortlisted", "skilled", [{}])).toBe(defaultNote("not_shortlisted", "skilled"));
  });
  it("the text they see", () => {
    for (const s of ["closed", "not_shortlisted", "withdrawn"]) expect(stageText(s, found)).not.toMatch(/applying|application/);
    expect(stageText("closed", {})).toContain("Thank you for applying.");
  });
});
