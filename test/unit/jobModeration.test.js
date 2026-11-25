import { describe, expect, it } from "vitest";
import { approvedFields, groupReports, isTakenDown, isWaiting, jobBadge, takedownReason } from "../../src/utils/jobModeration.js";
import { hasLimit, isBetaMode, isShortlistFull, planShortlistSlots, searchDailyLimitNow, shortlistLimitNow, shortlistsUsedText } from "../../src/utils/shortlist.js";
import { feeInForce, feeNow, pricingFrom } from "../../src/utils/pricing.js";
import { jobState, shortlistText } from "../../src/utils/jobsAdmin.js";

describe("job states", () => {
  it("taken down covers the old rejected jobs; the reason shows only then", () => {
    for (const status of ["taken_down", "rejected"]) expect(isTakenDown({ status })).toBe(true);
    for (const status of ["approved", "pending", undefined]) expect(isTakenDown({ status })).toBe(false);
    expect(isWaiting({ status: "pending" })).toBe(true);
    expect(takedownReason({ status: "taken_down", takedown: { reason: "Scam" } })).toBe("Scam");
    expect(takedownReason({ status: "approved", takedown: { reason: "Scam" } })).toBe("");
    expect(takedownReason({ status: "rejected" })).toBe("");
  });
  it("what the poster and the admin see; taken down wins over paused or closed", () => {
    expect(jobBadge({ status: "approved", jobStatus: "live" })).toBe("Live");
    expect(jobBadge({ status: "approved" })).toBe("Live");
    expect(jobBadge({ status: "approved", jobStatus: "paused" })).toBe("Paused");
    expect(jobBadge({ status: "pending" })).toBe("Not live yet");
    expect(jobBadge({ status: "taken_down", jobStatus: "paused" })).toBe("Taken down");
    expect(jobState({ status: "taken_down", jobStatus: "closed" })).toBe("rejected");
    expect(jobState({ status: "approved", jobStatus: "live" })).toBe("open");
    expect(jobState({ status: "pending" })).toBe("pending");
  });
  it("approving or restoring never reopens a job the employer closed", () => {
    expect(approvedFields({ status: "pending" })).toEqual({ status: "approved", jobStatus: "live" });
    expect(approvedFields({ jobStatus: null })).toEqual({ status: "approved", jobStatus: "live" });
    for (const jobStatus of ["paused", "filled", "closed"]) expect(approvedFields({ jobStatus })).toEqual({ status: "approved", jobStatus });
  });
});

describe("groupReports", () => {
  const r = (jobId, reason, seconds, extra) => ({ id: `${jobId}_${seconds}`, jobId, reason, createdAt: { seconds }, ...extra });
  const jobs = { a: { id: "a", status: "approved" }, b: { id: "b", status: "approved" }, c: { id: "c", status: "taken_down" } };
  it("most reported first, then the latest; checked, taken-down and deleted jobs are left out", () => {
    const rows = groupReports([r("a", "scam", 9), r("b", "scam", 1), r("b", "asks_money", 2), r("b", "scam", 3), r("c", "scam", 8), r("gone", "scam", 7), r("a", "scam", 5, { checkedAt: 1 })], jobs);
    expect(rows.map(x => [x.job.id, x.reports.length])).toEqual([["b", 3], ["a", 1]]);
    expect(rows[0].reasons).toEqual({ scam: 2, asks_money: 1 });
    const tie = groupReports([r("a", "scam", 1), r("b", "scam", 2)], jobs);
    expect(tie.map(x => x.job.id)).toEqual(["b", "a"]);
    expect(groupReports([], jobs)).toEqual([]);
  });
});

describe("beta mode", () => {
  it("is ON unless the admin switched it off", () => {
    for (const c of [null, undefined, {}, { betaMode: true }, { betaMode: null }]) expect(isBetaMode(c)).toBe(true);
    expect(isBetaMode({ betaMode: false })).toBe(false);
  });
  it("ON: no limits; OFF: the admin's numbers, else 10 and 20", () => {
    expect(shortlistLimitNow(null)).toBe(Infinity);
    expect(searchDailyLimitNow({ searchShortlistDailyLimit: 0 })).toBe(Infinity);
    expect(shortlistLimitNow({ betaMode: false })).toBe(10);
    expect(shortlistLimitNow({ betaMode: false, shortlistLimit: 4 })).toBe(4);
    expect(searchDailyLimitNow({ betaMode: false })).toBe(20);
    expect(searchDailyLimitNow({ betaMode: false, searchShortlistDailyLimit: 0 })).toBe(0);
  });
  it("screens: never full, and no 'of 10'", () => {
    expect(hasLimit(Infinity)).toBe(false);
    expect(isShortlistFull({ shortlistCount: 500 }, Infinity)).toBe(false);
    expect(shortlistsUsedText(12, Infinity)).toBe("Shortlists used: 12");
    expect(shortlistsUsedText(12, 10)).toBe("Shortlists used: 10 of 10");
    expect(shortlistText({ slots: 3, limit: Infinity })).toBe("3");
    expect(shortlistText({ slots: 3, limit: 10 })).toBe("3/10");
    const items = Array.from({ length: 30 }, (_, i) => ({ app: { id: i }, update: { contactUnlockedAt: 1 } }));
    expect(planShortlistSlots(items, { count: 25, limit: Infinity })).toMatchObject({ overLimit: [], slotted: { length: 30 } });
  });
  it("everything is free in beta, whatever the launch discount says", () => {
    const cfg = { jobPostFee: { list: 750, offer: 100, launchDiscount: false } };
    expect(feeNow(feeInForce(pricingFrom(cfg), "jobPostFee"))).toBe(0);
    expect(feeNow(feeInForce(pricingFrom({ ...cfg, betaMode: false }), "jobPostFee"))).toBe(100);
    expect(pricingFrom(cfg).jobPostFee.launchDiscount).toBe(false); // the saved setting isn't changed
  });
});
