// Pure unit tests for src/utils/jobModel.js — normaliseJob() over old-shape,
// new-shape and mixed job documents, plus legacy pay parsing.
import { describe, it, expect } from "vitest";
import { normaliseJob, parseLegacyPay, formatPay, isNeededNow } from "../../src/utils/jobModel.js";

// Matches what PostJobModal writes today (the deployed old shape).
const oldJob = (extra = {}) => ({
  id: "old1",
  postedByUid: "u1", postedByName: "Ravi", postedByType: "individual",
  businessName: "Ravi Tiles", jobTitle: "Showroom Executive",
  category: "Sales & Business Development", description: "Handle walk-in customers.",
  city: "Pune", state: "Maharashtra", pincode: "411045", jobType: "Full-time",
  salaryRange: "₹18,000 – ₹24,000/month", contactPhone: "9876543210",
  notAgencyDeclaration: true, status: "approved", jobStatus: "live",
  ...extra,
});

const newJob = (extra = {}) => ({
  id: "new1",
  postedByUid: "u2", businessName: "Shree Ganesh Plywood", jobTitle: "Masons for residential tower",
  lane: "skilled", functions: ["installation_trades"], workTypes: ["project_based", "daily_wage"],
  headcount: 15, experience: "3+ yrs", education: "", workingHours: "8 am – 6 pm",
  responsibilities: ["Blockwork and plaster, floors 9–14"], skills: ["AAC blockwork", "Internal plaster"],
  shortAssignment: { duration: "30 days", startDate: "2026-11-16", urgency: "this_week", certTools: "" },
  pay: { period: "day", min: 900, max: null, display: "show_range", incentives: "" },
  benefits: { accommodation: "Shared room near site", food_allowance: "" },
  evpText: "",
  description: "", city: "Thane", status: "approved", jobStatus: "live",
  ...extra,
});

describe("normaliseJob — old-shape jobs", () => {
  it("defaults the lane to professional and flags the job as legacy", () => {
    const j = normaliseJob(oldJob());
    expect(j.lane).toBe("professional");
    expect(j.isLegacy).toBe(true);
  });

  it("maps category / jobType only on an exact label match", () => {
    const j = normaliseJob(oldJob());
    expect(j.functions).toEqual(["sales_bd"]);
    expect(j.legacyCategory).toBeNull();
    expect(j.workTypes).toEqual(["full_time"]);
    expect(j.legacyJobType).toBeNull();
    expect(j.functionLabels).toEqual(["Sales & Business Development"]);
    expect(j.workTypeLabels).toEqual(["Full-time"]);
  });

  it("keeps a non-matching legacy category and 'Contract' job type as labels, no guessing", () => {
    const j = normaliseJob(oldJob({ category: "Warehouse & Logistics", jobType: "Contract" }));
    expect(j.functions).toEqual([]);
    expect(j.legacyCategory).toBe("Warehouse & Logistics");
    expect(j.workTypes).toEqual([]);
    expect(j.legacyJobType).toBe("Contract");
    expect(j.lane).toBe("professional");
  });

  it("approved exception: legacy category exactly 'Site & Skilled Trades' → skilled lane, no trade", () => {
    const j = normaliseJob(oldJob({ category: "Site & Skilled Trades" }));
    expect(j.lane).toBe("skilled");
    expect(j.isLegacy).toBe(true);
    expect(j.trade).toBeNull();
    expect(j.functions).toEqual([]);
    expect(j.legacyCategory).toBe("Site & Skilled Trades");
  });

  it("the exception is exact-match only", () => {
    expect(normaliseJob(oldJob({ category: "site & skilled trades" })).lane).toBe("professional");
    expect(normaliseJob(oldJob({ category: "Skilled Trades" })).lane).toBe("professional");
    expect(normaliseJob(oldJob({ category: " Site & Skilled Trades " })).lane).toBe("skilled"); // surrounding spaces only
  });

  it("a stored lane always wins over the legacy exception", () => {
    expect(normaliseJob(oldJob({ category: "Site & Skilled Trades", lane: "professional" })).lane).toBe("professional");
  });

  it("reads pay from salaryRange and keeps the original text", () => {
    const j = normaliseJob(oldJob());
    expect(j.pay).toEqual({ source: "legacy", period: "month", min: 18000, max: 24000, display: null, negotiable: false, incentives: null, text: "₹18,000 – ₹24,000/month" });
    expect(j.payText).toBe("₹18,000 – ₹24,000/month");
  });

  it("unreadable salary text: no numbers, text still shown", () => {
    const j = normaliseJob(oldJob({ salaryRange: "Negotiable, as per experience" }));
    expect(j.pay.min).toBeNull();
    expect(j.pay.max).toBeNull();
    expect(j.pay.period).toBeNull();
    expect(j.payText).toBe("Negotiable, as per experience");
  });

  it("missing salary → pay null, payText null", () => {
    const j = normaliseJob(oldJob({ salaryRange: "" }));
    expect(j.pay).toBeNull();
    expect(j.payText).toBeNull();
  });

  it("never invents fields old jobs don't have", () => {
    const j = normaliseJob(oldJob());
    expect(j.headcount).toBeNull();
    expect(j.experience).toBeNull();
    expect(j.education).toBeNull();
    expect(j.workingHours).toBeNull();
    expect(j.shortAssignment).toBeNull();
    expect(j.responsibilities).toEqual([]);
    expect(j.skills).toEqual([]);
    expect(j.benefits).toEqual({});
    expect(j.evpText).toBeNull();
    expect(j.description).toBe("Handle walk-in customers.");
  });

  it("old full-time job is not 'Needed Now'", () => {
    expect(normaliseJob(oldJob()).isNeededNow).toBe(false);
  });

  it("passes through identity, location and status fields", () => {
    const j = normaliseJob(oldJob());
    expect(j).toMatchObject({
      id: "old1", title: "Showroom Executive", businessName: "Ravi Tiles", postedByUid: "u1",
      city: "Pune", state: "Maharashtra", pincode: "411045", status: "approved", jobStatus: "live",
    });
  });
});

describe("normaliseJob — new-shape jobs", () => {
  it("keeps a valid trade key with its English + Hindi labels; drops an unknown one", () => {
    const j = normaliseJob(newJob({ trade: "mason" }));
    expect(j.trade).toBe("mason");
    expect(j.tradeLabel).toBe("Mason");
    expect(j.tradeLabelHi).toBe("राजमिस्त्री");
    expect(normaliseJob(newJob({ trade: "wizard" })).trade).toBeNull();
  });

  it("keeps lane, keys and structured fields", () => {
    const j = normaliseJob(newJob());
    expect(j.isLegacy).toBe(false);
    expect(j.lane).toBe("skilled");
    expect(j.functions).toEqual(["installation_trades"]);
    expect(j.workTypes).toEqual(["project_based", "daily_wage"]);
    expect(j.headcount).toBe(15);
    expect(j.experience).toBe("3+ yrs");
    expect(j.education).toBeNull(); // empty string → hidden
    expect(j.responsibilities).toEqual(["Blockwork and plaster, floors 9–14"]);
    expect(j.skills).toEqual(["AAC blockwork", "Internal plaster"]);
    expect(j.shortAssignment).toEqual({ duration: "30 days", startDate: "2026-11-16", urgency: "this_week", certTools: null });
    expect(j.benefits).toEqual({ accommodation: "Shared room near site", food_allowance: "" });
  });

  it("formats structured pay like the prototype", () => {
    expect(normaliseJob(newJob()).payText).toBe("₹900 / day");
    expect(normaliseJob(newJob({ pay: { period: "month", min: 22000, max: 28000, display: "show_range" } })).payText).toBe("₹22,000–28,000 / month");
    expect(normaliseJob(newJob({ pay: { period: "month", min: 22000, max: 28000, display: "negotiable" } })).payText).toBe("Negotiable");
    expect(normaliseJob(newJob({ pay: { period: "month", min: 22000, display: "undisclosed" } })).payText).toBe("Not disclosed");
    // L7: new jobs show "Negotiable" next to the range; old jobs above keep their text.
    expect(normaliseJob(newJob({ pay: { period: "month", min: 22000, max: 28000, display: "show_range", negotiable: true } })).payText).toBe("₹22,000–28,000 / month · Negotiable");
  });

  it("short work type or a duration makes it 'Needed Now'", () => {
    expect(normaliseJob(newJob()).isNeededNow).toBe(true);
    expect(normaliseJob(newJob({ workTypes: ["full_time"], shortAssignment: null })).isNeededNow).toBe(false);
    expect(normaliseJob(newJob({ workTypes: ["full_time"], shortAssignment: { duration: "2 weeks" } })).isNeededNow).toBe(true);
  });

  it("drops unknown keys and invalid values instead of keeping them", () => {
    const j = normaliseJob(newJob({
      lane: "wizard", functions: ["sales_bd", "made_up", "sales_bd"], workTypes: ["Full-time"],
      headcount: 0, benefits: { accommodation: "yes", free_car: "no" },
      shortAssignment: { urgency: "asap" },
      pay: { period: "fortnight", min: -5, max: "lots", display: "loud" },
    }));
    expect(j.lane).toBe("professional");
    expect(j.functions).toEqual(["sales_bd"]);
    expect(j.workTypes).toEqual([]);
    expect(j.headcount).toBeNull();
    expect(j.benefits).toEqual({ accommodation: "yes" });
    expect(j.shortAssignment).toBeNull();
    expect(j.pay).toMatchObject({ period: null, min: null, max: null, display: null });
    expect(j.payText).toBeNull();
  });

  it("drops a max below the min rather than guessing which is right", () => {
    const j = normaliseJob(newJob({ pay: { period: "month", min: 30000, max: 20000, display: "show_range" } }));
    expect(j.pay.min).toBe(30000);
    expect(j.pay.max).toBeNull();
    expect(j.payText).toBe("₹30,000 / month");
  });

  it("accepts skills as a comma-separated string", () => {
    expect(normaliseJob(newJob({ skills: "Laminates, customer handling ,," })).skills).toEqual(["Laminates", "customer handling"]);
  });
});

describe("normaliseJob — mixed shape", () => {
  it("new fields win; old fields fill only what's missing", () => {
    const j = normaliseJob(oldJob({
      lane: "professional", functions: ["marketing_brand"], workTypes: ["part_time"],
      pay: { period: "month", min: 30000, max: 40000, display: "show_range" },
    }));
    expect(j.functions).toEqual(["marketing_brand"]); // not sales_bd from category
    expect(j.workTypes).toEqual(["part_time"]);       // not full_time from jobType
    expect(j.pay.source).toBe("structured");
    expect(j.pay.text).toBe("₹18,000 – ₹24,000/month"); // legacy text kept for reference
    expect(j.payText).toBe("₹30,000–40,000 / month");
  });

  it("falls back to the legacy category when new functions are empty or invalid", () => {
    const j = normaliseJob(oldJob({ lane: "skilled", functions: ["bogus"] }));
    expect(j.functions).toEqual(["sales_bd"]);
    expect(j.lane).toBe("skilled");
  });

  it("returns null for a missing document", () => {
    expect(normaliseJob(null)).toBeNull();
    expect(normaliseJob(undefined)).toBeNull();
  });
});

describe("parseLegacyPay", () => {
  it("reads monthly, yearly, daily and hourly amounts", () => {
    expect(parseLegacyPay("₹25,000 – ₹35,000/month")).toEqual({ period: "month", min: 25000, max: 35000 });
    expect(parseLegacyPay("₹3,60,000 per annum")).toEqual({ period: "year", min: 360000, max: 360000 });
    expect(parseLegacyPay("₹900 per day")).toEqual({ period: "day", min: 900, max: 900 });
    expect(parseLegacyPay("Rs 150 per hour")).toEqual({ period: "hour", min: 150, max: 150 });
  });

  it("returns null when it can't read the salary confidently", () => {
    expect(parseLegacyPay("")).toBeNull();
    expect(parseLegacyPay(undefined)).toBeNull();
    expect(parseLegacyPay("Negotiable")).toBeNull();
    expect(parseLegacyPay("25000-35000")).toBeNull();            // no currency / period
    expect(parseLegacyPay("₹25,000 – ₹35,000")).toBeNull();       // no period
    expect(parseLegacyPay("₹5,000 per week")).toBeNull();         // no weekly pay period
    expect(parseLegacyPay("₹25k–35k/month")).toBeNull();          // shorthand
    expect(parseLegacyPay("₹3 lakh per annum")).toBeNull();
    expect(parseLegacyPay("₹4.5 LPA per year")).toBeNull();
    expect(parseLegacyPay("₹20,000/month + 2 incentives")).toBeNull(); // stray small number
  });
});

describe("formatPay / isNeededNow edge cases", () => {
  it("formatPay(null) is null", () => {
    expect(formatPay(null)).toBeNull();
  });

  it("isNeededNow tolerates missing fields", () => {
    expect(isNeededNow({})).toBe(false);
  });
});
