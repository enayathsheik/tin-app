// Pure unit tests for src/utils/jobDraft.js — what the Post-a-job wizard
// saves (new + legacy fields), hidden pay, storeId, step validation,
// edit drafts from old/new jobs, and the D2 industry prefill.
import { describe, it, expect } from "vitest";
import {
  buildJobFields, changedContentKeys, draftFromJob, emptyDraft, isShortAssignment, rememberedBusiness, validateAll, validateStep,
} from "../../src/utils/jobDraft.js";
import { BUSINESS_TYPE_INDUSTRY, INDUSTRIES, industryPrefill, isKey } from "../../src/data/jobsTaxonomy.js";
import { normaliseJob } from "../../src/utils/jobModel.js";
import { buildJobPostingJsonLd } from "../../src/utils/jobJsonLd.js";
import { jobMatchesFilters } from "../../src/utils/jobFilters.js";

const filled = (extra = {}) => ({
  ...emptyDraft({}),
  business: { name: "Shree Ganesh Plywood", industry: "retail_distribution", city: "Mumbai" },
  lane: "professional", title: "Area Sales Manager", headcount: "2",
  functions: ["sales_bd", "channel_sales"], workTypes: ["full_time", "permanent"],
  city: "Mumbai", state: "Maharashtra", pincode: "400053",
  experience: "5–8 yrs", workingHours: "10–7", education: "Graduate",
  duties: "Grow dealer network\n\n  Run architect visits  ", skills: "Laminates, Dealer management,",
  pay: { period: "year", min: "6,00,000", max: "800000", display: "show_range", incentives: "+ incentive" },
  evpMode: "list", benefits: { sales_incentives: "Monthly", made_up: "x" }, evpText: "ignored in list mode",
  contactPhone: "9800000000", notAgencyDeclaration: true,
  ...extra,
});

describe("industry prefill (D2)", () => {
  it("maps every TIN business type in the approved table to a real industry key", () => {
    for (const k of Object.values(BUSINESS_TYPE_INDUSTRY)) expect(isKey(INDUSTRIES, k)).toBe(true);
    expect(industryPrefill({ businessType: "Distributor" })).toBe("retail_distribution");
    expect(industryPrefill({ businessType: "Designer" })).toBe("designers"); // own type since B1
    expect(industryPrefill({ businessType: "Wholesaler" })).toBe("wholesalers");
    expect(industryPrefill({ businessType: "Consultant" })).toBe("consultants");
  });

  it("linked store's business type wins over role; role used when there's no store", () => {
    expect(industryPrefill({ businessType: "Manufacturer", role: "retailer" })).toBe("manufacturers");
    expect(industryPrefill({ role: "contractor" })).toBe("contractors");
    expect(industryPrefill({ role: "architect" })).toBe("architects_interior_firms");
  });

  it("anything else → no prefill (the poster picks)", () => {
    expect(industryPrefill({ role: "consumer" })).toBeNull();
    expect(industryPrefill({ role: "contributor" })).toBeNull();
    expect(industryPrefill({ businessType: "Shop" })).toBeNull();
    expect(industryPrefill({})).toBeNull();
  });
});

describe("emptyDraft prefill", () => {
  it("from a linked store", () => {
    const d = emptyDraft({ role: "consumer", phone: "98" }, { storeName: "A Tiles", businessType: "Wholesaler", city: "Pune" });
    expect(d.business).toEqual({ name: "A Tiles", industry: "wholesalers", city: "Pune" });
    expect(d.contactPhone).toBe("98");
  });

  it("from remembered business details, else company / role", () => {
    expect(emptyDraft({ jobBusiness: { name: "Saved Co", industry: "brands", city: "Thane" }, role: "retailer" }).business)
      .toEqual({ name: "Saved Co", industry: "brands", city: "Thane" });
    expect(emptyDraft({ company: "Acme", role: "contractor", city: "Delhi" }).business)
      .toEqual({ name: "Acme", industry: "contractors", city: "Delhi" });
    expect(emptyDraft({ storeName: "HOM SYSTEM INDIA", role: "retailer" }).business.name).toBe("HOM SYSTEM INDIA");
  });
});

describe("buildJobFields — what gets saved", () => {
  it("writes the new-shape fields", () => {
    const f = buildJobFields(filled());
    expect(f).toMatchObject({
      businessName: "Shree Ganesh Plywood", industry: "retail_distribution", lane: "professional", trade: null,
      jobTitle: "Area Sales Manager", headcount: 2, functions: ["sales_bd", "channel_sales"], workTypes: ["full_time", "permanent"],
      city: "Mumbai", state: "Maharashtra", pincode: "400053", experience: "5–8 yrs", workingHours: "10–7", education: "Graduate",
      responsibilities: ["Grow dealer network", "Run architect visits"], skills: ["Laminates", "Dealer management"],
      shortAssignment: null, benefits: { sales_incentives: "Monthly" }, evpText: "",
      contactPhone: "9800000000", notAgencyDeclaration: true,
    });
    expect(f.pay).toEqual({ period: "year", min: 600000, max: 800000, display: "show_range", negotiable: false, incentives: "+ incentive" });
  });

  it("also writes the legacy fields older readers use", () => {
    const f = buildJobFields(filled());
    expect(f.category).toBe("Sales & Business Development");
    expect(f.jobType).toBe("Full-time");
    expect(f.salaryRange).toBe("₹6,00,000–8,00,000 / year");
    expect(f.description).toBe("");
  });

  it("the saved job reads back through normaliseJob as the same thing", () => {
    const j = normaliseJob({ id: "x", ...buildJobFields(filled()) });
    expect(j.isLegacy).toBe(false);
    expect(j.functions).toEqual(["sales_bd", "channel_sales"]);
    expect(j.payText).toBe("₹6,00,000–8,00,000 / year");
    expect(j.industry).toBe("retail_distribution");
    expect(j.industryLabel).toBe("Retailers, Distributors & Dealers");
  });

  it("L7: always saves a shown range; \"Negotiable\" is a flag next to it; old hidden-pay choices are ignored", () => {
    const neg = buildJobFields(filled({ pay: { period: "month", min: "22000", max: "28000", display: "show_range", negotiable: true, incentives: "x" } }));
    expect(neg.pay).toEqual({ period: "month", min: 22000, max: 28000, display: "show_range", negotiable: true, incentives: "x" });
    expect(neg.salaryRange).toBe("₹22,000–28,000 / month · Negotiable");
    for (const display of ["negotiable", "undisclosed"]) {
      const f = buildJobFields(filled({ pay: { period: "month", min: "22000", max: "28000", display, incentives: "" } }));
      expect(f.pay.display).toBe("show_range");
      expect(f.pay.min).toBe(22000);
    }
  });

  it("storeId only when the account has a store link", () => {
    expect(buildJobFields(filled())).not.toHaveProperty("storeId");
    expect(buildJobFields(filled(), { storeId: "s1" }).storeId).toBe("s1");
  });

  it("skilled lane: trade saved, title falls back to the trade name", () => {
    const f = buildJobFields(filled({ lane: "skilled", trade: "mason", title: "", functions: ["installation_trades"] }));
    expect(f.trade).toBe("mason");
    expect(f.jobTitle).toBe("Mason");
    expect(f.category).toBe("Installation & Skilled Trades");
  });

  it("short assignment details saved only for short work types", () => {
    const sa = { duration: "30 days", startDate: "2026-11-20", urgency: "this_week", certTools: "Own tools" };
    expect(buildJobFields(filled({ workTypes: ["daily_wage"], shortAssignment: sa })).shortAssignment).toEqual(sa);
    expect(buildJobFields(filled({ workTypes: ["full_time"], shortAssignment: sa })).shortAssignment).toBeNull();
  });

  it("'write it yourself' saves the text and no ticked benefits", () => {
    const f = buildJobFields(filled({ evpMode: "write", evpText: "  Saturdays off  " }));
    expect(f.evpText).toBe("Saturdays off");
    expect(f.benefits).toEqual({});
  });

  it("a 'to' below 'from' falls back to 'from'; equal from/to shows a single amount but keeps both", () => {
    expect(buildJobFields(filled({ pay: { period: "month", min: "30000", max: "20000", display: "show_range" } })).pay.max).toBe(30000);
    const eq = buildJobFields(filled({ pay: { period: "day", min: "900", max: "900", display: "show_range" } }));
    expect(eq.salaryRange).toBe("₹900 / day");
    expect(eq.pay).toMatchObject({ min: 900, max: 900 });
  });
});

describe("validation", () => {
  it("a fully filled draft passes every step", () => {
    expect(validateAll(filled())).toEqual([]);
  });

  it("business: name and industry required", () => {
    const errs = validateStep(0, filled({ business: { name: "", industry: "", city: "" } })).map(e => e.field);
    expect(errs).toEqual(["business.name", "business.industry"]);
  });

  it("the job: required fields, trade for skilled, pincode format, short-assignment duration", () => {
    const fields = (d) => validateStep(1, d).map(e => e.field);
    expect(fields(filled({ title: "" }))).toContain("title");
    expect(fields(filled({ lane: "skilled", trade: "" }))).toContain("trade");
    expect(fields(filled({ headcount: "0" }))).toContain("headcount");
    expect(fields(filled({ headcount: "1.5" }))).toContain("headcount");
    expect(fields(filled({ functions: [] }))).toContain("functions");
    expect(fields(filled({ workTypes: [] }))).toContain("workTypes");
    expect(fields(filled({ city: " " }))).toContain("city");
    expect(fields(filled({ pincode: "4000" }))).toContain("pincode");
    expect(fields(filled({ duties: "  \n " }))).toContain("duties");
    expect(fields(filled({ workTypes: ["daily_wage"] }))).toContain("shortAssignment.duration");
  });

  it("L7 pay: from AND to are required (no Don't disclose / Negotiable-instead); to ≥ from", () => {
    const fields = (pay) => validateStep(2, filled({ pay })).map(e => e.field);
    expect(fields({ period: "month", min: "", max: "", display: "show_range" })).toEqual(["pay.min", "pay.max"]);
    expect(fields({ period: "month", min: "", max: "", display: "negotiable" })).toEqual(["pay.min", "pay.max"]);
    expect(fields({ period: "month", min: "", max: "", display: "undisclosed" })).toEqual(["pay.min", "pay.max"]);
    expect(fields({ period: "month", min: "20000", max: "", display: "show_range" })).toEqual(["pay.max"]);
    expect(fields({ period: "month", min: "20000", max: "20000", display: "show_range", negotiable: true })).toEqual([]);
    expect(fields({ period: "month", min: "30000", max: "20000", display: "show_range" })).toContain("pay.max");
    expect(fields({ period: "month", min: "30000", max: "abc", display: "show_range" })).toContain("pay.max");
  });

  it("review: contact phone and agency declaration required", () => {
    const fields = validateStep(4, filled({ contactPhone: "", notAgencyDeclaration: false })).map(e => e.field);
    expect(fields).toEqual(["contactPhone", "notAgencyDeclaration"]);
  });

  it("isShortAssignment follows the short work types", () => {
    expect(isShortAssignment(filled({ workTypes: ["on_call"] }))).toBe(true);
    expect(isShortAssignment(filled())).toBe(false);
  });
});

describe("editing: draftFromJob", () => {
  const oldJob = {
    id: "v47", postedByUid: "u", businessName: "HOM SYSTEM INDIA", jobTitle: "Interior Designer",
    category: "Design & Architecture", description: "Design as per customer requirement", city: "Mumbai",
    jobType: "Full-time", salaryRange: "35000", contactPhone: "98", notAgencyDeclaration: true, status: "approved", jobStatus: "live",
  };

  it("an old job opens with its values mapped, never invented", () => {
    const d = draftFromJob(oldJob, { role: "retailer" });
    expect(d.lane).toBe("professional");
    expect(d.title).toBe("Interior Designer");
    expect(d.functions).toEqual(["design_architecture"]);
    expect(d.workTypes).toEqual(["full_time"]);
    expect(d.duties).toBe("Design as per customer requirement");
    expect(d.business.industry).toBe("retail_distribution"); // prefill from role, editable
    expect(d.pay.min).toBe("");
    expect(d.legacySalaryText).toBe("35000");
  });

  it("L7: editing an old job with unreadable salary text needs a real range (text shown as a hint)", () => {
    const d = draftFromJob(oldJob);
    expect(d.legacySalaryText).toBe("35000");
    expect(validateStep(2, d).map(e => e.field)).toEqual(["pay.min", "pay.max"]);
    expect(buildJobFields({ ...d, pay: { ...d.pay, min: "35000", max: "40000" } }).salaryRange).toBe("₹35,000–40,000 / month");
  });

  it("L7: an old Negotiable job edited here keeps Negotiable as the tick; Don't disclose becomes a range to fill", () => {
    const neg = draftFromJob({ id: "n", jobTitle: "A", lane: "professional", pay: { period: "month", min: null, max: null, display: "negotiable" } });
    expect(neg.pay).toMatchObject({ display: "show_range", negotiable: true, min: "", max: "" });
    const und = draftFromJob({ id: "u", jobTitle: "A", lane: "professional", pay: { period: "day", min: null, max: null, display: "undisclosed" } });
    expect(und.pay).toMatchObject({ display: "show_range", negotiable: false, period: "day" });
  });

  it("a new-shape job round-trips: draft → fields → draft", () => {
    const fields = buildJobFields(filled({ pay: { period: "month", min: "40000", max: "50000", display: "show_range", incentives: "" } }));
    const d = draftFromJob({ id: "n1", ...fields });
    expect(buildJobFields(d)).toEqual(fields);
  });

  it("changedContentKeys lists only what changed", () => {
    const before = { id: "n1", ...buildJobFields(filled()) };
    const after = buildJobFields(filled({ title: "Regional Manager" }));
    expect(changedContentKeys(before, after)).toEqual(["jobTitle"]);
    expect(changedContentKeys(before, buildJobFields(filled()))).toEqual([]);
  });

  it("rememberedBusiness keeps only the business details", () => {
    expect(rememberedBusiness(filled())).toEqual({ name: "Shree Ganesh Plywood", industry: "retail_distribution", city: "Mumbai" });
  });
});

describe("SEO + filters pick up the new data through normaliseJob", () => {
  const fields = buildJobFields(filled(), { storeId: "storeG" });

  it("JSON-LD gets industry and a link to the store, only when present", () => {
    const ld = buildJobPostingJsonLd({ ...fields, createdAtISO: "2026-11-18T00:00:00.000Z" });
    expect(ld.industry).toBe("Retailers, Distributors & Dealers");
    expect(ld.hiringOrganization.sameAs).toBe("https://tinit.in/store/storeG");
    expect(ld.totalJobOpenings).toBe(2);
    const plain = buildJobPostingJsonLd({ jobTitle: "Old", city: "Pune", createdAtISO: "2026-01-01T00:00:00.000Z" });
    expect(plain).not.toHaveProperty("industry");
    expect(plain.hiringOrganization).not.toHaveProperty("sameAs");
  });

  it("industry filter matches new jobs; old jobs only under 'All industries'", () => {
    const j = normaliseJob({ id: "a", ...fields });
    const old = normaliseJob({ id: "b", jobTitle: "Old", category: "Office & Admin" });
    expect(jobMatchesFilters(j, { ind: "retail_distribution" })).toBe(true);
    expect(jobMatchesFilters(j, { ind: "brands" })).toBe(false);
    expect(jobMatchesFilters(old, { ind: "retail_distribution" })).toBe(false);
    expect(jobMatchesFilters(old, {})).toBe(true);
  });
});
