import { normaliseJob } from "./jobModel.js";
import { BENEFITS, labelOf } from "../data/jobsTaxonomy.js";

// schema.org employmentType for each TYPES key. Keys with no fitting
// schema value (e.g. "permanent", which says nothing about hours) are
// simply not mapped.
const EMPLOYMENT_TYPE_BY_KEY = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  temporary: "TEMPORARY",
  internship: "INTERN",
  fixed_term: "CONTRACTOR",
  project_based: "CONTRACTOR",
  freelance: "CONTRACTOR",
  consultative: "CONTRACTOR",
  retainer: "CONTRACTOR",
  daily_wage: "PER_DIEM",
  on_call: "OTHER",
  apprenticeship: "OTHER",
};
// Legacy free-text jobType values with no taxonomy key (kept from the
// original mapping so already-indexed jobs don't change).
const LEGACY_EMPLOYMENT_TYPE = { Contract: "CONTRACTOR" };

const UNIT_TEXT = { month: "MONTH", year: "YEAR", day: "DAY", hour: "HOUR" }; // "project" has no schema unit

// Builds a schema.org JobPosting structured-data object from a job listing
// (old or new shape — it goes through normaliseJob()). `job` must already
// have `createdAtISO` (a plain ISO date string) set by the caller — this
// module never touches a Firestore Timestamp directly so it stays importable
// from both the Vite client bundle and the Node prerender script.
//
// Never invents a value: every optional property is emitted only when the
// job actually has it. validThrough is never emitted (there's no expiry
// field). baseSalary is emitted only for a readable amount the employer
// chose to show — never for "Negotiable" / "Don't disclose" pay.
export function buildJobPostingJsonLd(rawJob) {
  const job = normaliseJob(rawJob);
  const description = [
    job.description,
    job.responsibilities.length ? job.responsibilities.map(r => `• ${r}`).join("\n") : "",
  ].filter(Boolean).join("\n\n") || job.title;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description,
    datePosted: rawJob.createdAtISO,
    hiringOrganization: {
      "@type": "Organization",
      name: job.businessName || job.postedByName,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        ...(job.state ? { addressRegion: job.state } : {}),
        ...(job.pincode ? { postalCode: job.pincode } : {}),
        addressCountry: "IN",
      },
    },
  };

  const employmentTypes = [...new Set([
    ...job.workTypes.map(k => EMPLOYMENT_TYPE_BY_KEY[k]),
    LEGACY_EMPLOYMENT_TYPE[job.legacyJobType],
  ].filter(Boolean))];
  if (employmentTypes.length === 1) jsonLd.employmentType = employmentTypes[0];
  else if (employmentTypes.length > 1) jsonLd.employmentType = employmentTypes;

  const salary = publicSalary(job.pay);
  if (salary) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "INR",
      value: { "@type": "QuantitativeValue", minValue: salary.min, maxValue: salary.max, unitText: salary.unitText },
    };
  }

  if (job.headcount) jsonLd.totalJobOpenings = job.headcount;
  if (job.experience) jsonLd.experienceRequirements = job.experience;
  if (job.education) jsonLd.educationRequirements = job.education;
  if (job.workingHours) jsonLd.workHours = job.workingHours;
  if (job.skills.length) jsonLd.skills = job.skills.join(", ");

  const benefitTexts = Object.entries(job.benefits).map(([k, details]) =>
    details ? `${labelOf(BENEFITS, k)}: ${details}` : labelOf(BENEFITS, k));
  if (job.evpText) benefitTexts.push(job.evpText);
  if (benefitTexts.length) jsonLd.jobBenefits = benefitTexts.join("; ");

  return jsonLd;
}

// A salary is published only when it's a readable amount that the employer
// shows publicly: legacy text the parser could read, or structured pay with
// display "show_range". Hidden pay and unknown display never appear.
function publicSalary(pay) {
  if (!pay || pay.min == null) return null;
  const unitText = UNIT_TEXT[pay.period];
  if (!unitText) return null;
  const shown = pay.source === "legacy" ? pay.display == null : pay.display === "show_range";
  if (!shown) return null;
  return { min: pay.min, max: pay.max ?? pay.min, unitText };
}
