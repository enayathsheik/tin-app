// Pure unit tests for src/utils/jobFilters.js — pay bands, experience bands,
// search and the combined filter, all on normalised jobs.
import { describe, it, expect } from "vitest";
import { normaliseJob } from "../../src/utils/jobModel.js";
import {
  PAY_BANDS, EXPERIENCE_BANDS, bandablePay, jobMatchesPayBand, parseExperience,
  jobMatchesExperience, jobMatchesSearch, jobInLane, jobMatchesFilters, filtersFromSearchParams,
} from "../../src/utils/jobFilters.js";

const legacy = (salaryRange, extra = {}) => normaliseJob({ jobTitle: "Sales Exec", city: "Pune", salaryRange, ...extra });
const structured = (pay, extra = {}) => normaliseJob({ jobTitle: "Mason", lane: "skilled", pay, ...extra });
const bandsFor = (job) => PAY_BANDS.filter(b => jobMatchesPayBand(job, b.id)).map(b => b.id);

describe("pay bands", () => {
  it("'Any' (empty) matches every job, including unreadable and hidden pay", () => {
    expect(jobMatchesPayBand(legacy("Negotiable"), "")).toBe(true);
    expect(jobMatchesPayBand(structured({ period: "month", min: 20000, display: "undisclosed" }), "")).toBe(true);
    expect(jobMatchesPayBand(normaliseJob({ jobTitle: "x" }), "")).toBe(true);
  });

  it("puts readable legacy monthly pay in the right band", () => {
    expect(bandsFor(legacy("₹12,000/month"))).toEqual(["m_upto15k"]);
    expect(bandsFor(legacy("₹30,000 per month"))).toEqual(["m_25_40k"]);
    expect(bandsFor(legacy("₹75,000/month"))).toEqual(["m_60kplus"]);
  });

  it("a range spanning two bands shows in both (overlap)", () => {
    expect(bandsFor(legacy("₹20,000 – ₹30,000/month"))).toEqual(["m_15_25k", "m_25_40k"]);
    expect(bandsFor(structured({ period: "day", min: 800, max: 1000, display: "show_range" }))).toEqual(["d_600_900", "d_900_1200"]);
  });

  it("band edges: each band includes its upper figure, not its lower one", () => {
    expect(bandsFor(legacy("₹15,000/month"))).toEqual(["m_upto15k"]);
    expect(bandsFor(legacy("₹25,000/month"))).toEqual(["m_15_25k"]);
    expect(bandsFor(legacy("₹60,001/month"))).toEqual(["m_60kplus"]);
    expect(bandsFor(structured({ period: "day", min: 900, display: "show_range" }))).toEqual(["d_600_900"]);
  });

  it("yearly pay is compared per month (÷12); day pay never becomes month pay", () => {
    expect(bandsFor(legacy("₹6,00,000 per annum"))).toEqual(["m_40_60k"]);
    expect(bandsFor(structured({ period: "day", min: 900, display: "show_range" })).every(id => id.startsWith("d_"))).toBe(true);
    expect(bandsFor(legacy("₹30,000 per month")).every(id => id.startsWith("m_"))).toBe(true);
  });

  it("unreadable, missing, hourly and project pay match no band", () => {
    expect(bandsFor(legacy("Negotiable"))).toEqual([]);
    expect(bandsFor(legacy("₹25k–35k/month"))).toEqual([]);
    expect(bandsFor(legacy(""))).toEqual([]);
    expect(bandsFor(legacy("Rs 150 per hour"))).toEqual([]);
    expect(bandsFor(structured({ period: "project", min: 45000, display: "show_range" }))).toEqual([]);
  });

  it("NEVER filters on hidden pay: Negotiable / Don't disclose match no band even with numbers stored", () => {
    expect(bandsFor(structured({ period: "month", min: 22000, max: 28000, display: "negotiable" }))).toEqual([]);
    expect(bandsFor(structured({ period: "month", min: 22000, max: 28000, display: "undisclosed" }))).toEqual([]);
    expect(bandablePay({ period: "month", min: 22000, display: "undisclosed" })).toBeNull();
  });

  it("unknown band id behaves like 'Any'", () => {
    expect(jobMatchesPayBand(legacy("Negotiable"), "nope")).toBe(true);
  });
});

describe("experience", () => {
  it("parses only clear patterns", () => {
    expect(parseExperience("Fresher")).toEqual({ min: 0, max: 0 });
    expect(parseExperience("freshers")).toEqual({ min: 0, max: 0 });
    expect(parseExperience("Any")).toEqual({ min: 0, max: Infinity });
    expect(parseExperience("2–4 yrs")).toEqual({ min: 2, max: 4 });
    expect(parseExperience("2-4 years")).toEqual({ min: 2, max: 4 });
    expect(parseExperience("5 to 8 yrs")).toEqual({ min: 5, max: 8 });
    expect(parseExperience("3+ yrs")).toEqual({ min: 3, max: Infinity });
    expect(parseExperience("15+")).toEqual({ min: 15, max: Infinity });
    expect(parseExperience("2-4")).toEqual({ min: 2, max: 4 }); // range in the Experience field = years
    expect(parseExperience("5 years")).toEqual({ min: 5, max: 5 });
  });

  it("returns null for anything unclear", () => {
    for (const t of ["", "  ", "Experienced", "some experience preferred", "4–2 yrs", "5", "min 3 yrs in sales", null, undefined, 3]) {
      expect(parseExperience(t)).toBeNull();
    }
  });

  const exp = (experience) => normaliseJob({ jobTitle: "x", lane: "professional", experience });
  const bandsOf = (job) => EXPERIENCE_BANDS.filter(b => jobMatchesExperience(job, b.id)).map(b => b.id);

  it("a job counts in every band its range overlaps", () => {
    expect(bandsOf(exp("2–4 yrs"))).toEqual(["0_2", "2_5"]);
    expect(bandsOf(exp("3+ yrs"))).toEqual(["2_5", "5_10", "10plus"]);
    expect(bandsOf(exp("Fresher"))).toEqual(["fresher", "0_2"]);
    expect(bandsOf(exp("Any"))).toEqual(EXPERIENCE_BANDS.map(b => b.id));
  });

  it("old jobs (no experience) and unclear text show only under 'Any'", () => {
    expect(bandsOf(normaliseJob({ jobTitle: "old", category: "Office & Admin" }))).toEqual([]);
    expect(bandsOf(exp("Experienced"))).toEqual([]);
    expect(jobMatchesExperience(normaliseJob({ jobTitle: "old" }), "")).toBe(true);
  });
});

describe("search, lane and combined filters", () => {
  const sales = normaliseJob({ id: "a", jobTitle: "Area Sales Manager", businessName: "Shree Ganesh Plywood", city: "Mumbai", category: "Sales & Business Development", jobType: "Full-time", salaryRange: "₹30,000 per month" });
  const mason = normaliseJob({ id: "b", jobTitle: "Masons for tower", lane: "skilled", trade: "mason", workTypes: ["daily_wage"], city: "Thane", skills: ["AAC blockwork"], pay: { period: "day", min: 900, display: "show_range" }, experience: "3+ yrs" });
  const oldTrades = normaliseJob({ id: "c", jobTitle: "Site helper", category: "Site & Skilled Trades", jobType: "Contract", city: "Pune" });

  it("search matches title, business, city, skills, Hindi trade label; all words must match", () => {
    expect(jobMatchesSearch(sales, "plywood mumbai")).toBe(true);
    expect(jobMatchesSearch(mason, "blockwork")).toBe(true);
    expect(jobMatchesSearch(mason, "राजमिस्त्री")).toBe(true);
    expect(jobMatchesSearch(sales, "plywood thane")).toBe(false);
    expect(jobMatchesSearch(sales, "")).toBe(true);
  });

  it("lanes: stored lane, legacy exception, and derived Needed Now", () => {
    expect(jobInLane(sales, "professional")).toBe(true);
    expect(jobInLane(mason, "skilled")).toBe(true);
    expect(jobInLane(oldTrades, "skilled")).toBe(true);
    expect(jobInLane(mason, "needed-now")).toBe(true);   // daily_wage is a short type
    expect(jobInLane(sales, "needed-now")).toBe(false);
    expect(jobInLane(sales, "")).toBe(true);
  });

  it("old 'Site & Skilled Trades' job shows under 'All trades' but no specific trade", () => {
    expect(jobMatchesFilters(oldTrades, { lane: "skilled" })).toBe(true);
    expect(jobMatchesFilters(oldTrades, { lane: "skilled", trade: "helper" })).toBe(false);
  });

  it("function / work type filters use keys; legacy-only labels show only under 'All'", () => {
    expect(jobMatchesFilters(sales, { fn: "sales_bd" })).toBe(true);
    expect(jobMatchesFilters(sales, { type: "full_time" })).toBe(true);
    expect(jobMatchesFilters(oldTrades, { type: "fixed_term" })).toBe(false); // "Contract" is not guessed
    expect(jobMatchesFilters(oldTrades, {})).toBe(true);
  });

  it("combines every filter", () => {
    const f = { lane: "skilled", q: "mason", trade: "mason", type: "daily_wage", city: "thane", exp: "5_10", pay: "d_600_900" };
    expect(jobMatchesFilters(mason, f)).toBe(true);
    expect(jobMatchesFilters(mason, { ...f, city: "Pune" })).toBe(false);
    expect(jobMatchesFilters(mason, { ...f, pay: "m_15_25k" })).toBe(false);
  });

  it("reads filters from the URL query string, ignoring unknown keys", () => {
    const f = filtersFromSearchParams(new URLSearchParams("fn=sales_bd&city=Pune&utm=x&pay="));
    expect(f).toEqual({ fn: "sales_bd", city: "Pune" });
  });
});
