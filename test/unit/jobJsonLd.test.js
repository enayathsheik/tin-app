// Pure unit tests for src/utils/jobJsonLd.js — schema.org JobPosting built
// through normaliseJob(). Never invents values; never leaks hidden pay.
import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd } from "../../src/utils/jobJsonLd.js";

const base = { createdAtISO: "2026-11-01T00:00:00.000Z", city: "Pune", businessName: "Acme Tiles" };

describe("buildJobPostingJsonLd — old-shape jobs", () => {
  const old = { ...base, jobTitle: "Showroom Executive", description: "Handle walk-ins.", category: "Office & Admin", jobType: "Full-time", salaryRange: "₹18,000 – ₹24,000/month", state: "Maharashtra", pincode: "411045" };

  it("keeps the existing core fields", () => {
    const ld = buildJobPostingJsonLd(old);
    expect(ld).toMatchObject({
      "@type": "JobPosting", title: "Showroom Executive", description: "Handle walk-ins.",
      datePosted: "2026-11-01T00:00:00.000Z", employmentType: "FULL_TIME",
      hiringOrganization: { "@type": "Organization", name: "Acme Tiles" },
      jobLocation: { address: { addressLocality: "Pune", addressRegion: "Maharashtra", postalCode: "411045", addressCountry: "IN" } },
    });
    expect(ld.baseSalary.value).toEqual({ "@type": "QuantitativeValue", minValue: 18000, maxValue: 24000, unitText: "MONTH" });
  });

  it("legacy 'Contract' keeps its CONTRACTOR mapping", () => {
    expect(buildJobPostingJsonLd({ ...old, jobType: "Contract" }).employmentType).toBe("CONTRACTOR");
  });

  it("never invents: no salary from shorthand/unreadable text, no extra fields, no validThrough", () => {
    for (const salaryRange of ["₹25k–35k/month", "Negotiable", ""]) {
      expect(buildJobPostingJsonLd({ ...old, salaryRange })).not.toHaveProperty("baseSalary");
    }
    const ld = buildJobPostingJsonLd(old);
    for (const k of ["validThrough", "totalJobOpenings", "experienceRequirements", "educationRequirements", "workHours", "skills", "jobBenefits"]) {
      expect(ld).not.toHaveProperty(k);
    }
  });
});

describe("buildJobPostingJsonLd — new-shape jobs", () => {
  const neu = {
    ...base, jobTitle: "Masons for tower", description: "", lane: "skilled", trade: "mason",
    workTypes: ["project_based", "daily_wage", "permanent"], headcount: 15, experience: "3+ yrs",
    education: "", workingHours: "8 am – 6 pm", responsibilities: ["Blockwork", "Plaster"], skills: ["AAC blockwork", "Plaster"],
    pay: { period: "day", min: 900, max: null, display: "show_range", incentives: "" },
    benefits: { accommodation: "Shared room", food_allowance: "" },
  };

  it("adds new fields only when present", () => {
    const ld = buildJobPostingJsonLd(neu);
    expect(ld.employmentType).toEqual(["CONTRACTOR", "PER_DIEM"]); // "permanent" has no schema value
    expect(ld.totalJobOpenings).toBe(15);
    expect(ld.experienceRequirements).toBe("3+ yrs");
    expect(ld).not.toHaveProperty("educationRequirements"); // empty string
    expect(ld.workHours).toBe("8 am – 6 pm");
    expect(ld.skills).toBe("AAC blockwork, Plaster");
    expect(ld.jobBenefits).toBe("Accommodation: Shared room; Food allowance");
    expect(ld.description).toBe("• Blockwork\n• Plaster");
    expect(ld.baseSalary.value).toEqual({ "@type": "QuantitativeValue", minValue: 900, maxValue: 900, unitText: "DAY" });
  });

  it("NEVER publishes hidden pay (Negotiable / Don't disclose) or pay with unknown display", () => {
    for (const display of ["negotiable", "undisclosed", null]) {
      const ld = buildJobPostingJsonLd({ ...neu, pay: { period: "month", min: 22000, max: 28000, display } });
      expect(ld).not.toHaveProperty("baseSalary");
      expect(JSON.stringify(ld)).not.toContain("22000");
    }
  });

  it("project pay has no schema unit → no baseSalary", () => {
    expect(buildJobPostingJsonLd({ ...neu, pay: { period: "project", min: 45000, display: "show_range" } })).not.toHaveProperty("baseSalary");
  });

  it("falls back to the title when there's no description or duties", () => {
    expect(buildJobPostingJsonLd({ ...neu, responsibilities: [] }).description).toBe("Masons for tower");
  });
});
