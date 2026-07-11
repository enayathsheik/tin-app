import { parseSalaryRange } from "./salaryParser.js";

const EMPLOYMENT_TYPE_MAP = {
  "Full-time": "FULL_TIME",
  "Part-time": "PART_TIME",
  "Contract": "CONTRACTOR",
};

// Builds a schema.org JobPosting structured-data object from a job listing.
// `job` must already have `createdAtISO` (a plain ISO date string) set by the
// caller — this module never touches a Firestore Timestamp directly so it
// stays importable from both the Vite client bundle (firebase/firestore
// Timestamps) and the Node prerender script (firebase-admin Timestamps)
// without depending on either SDK.
//
// validThrough is intentionally never emitted — there's no such field on job
// documents, and fabricating an expiry date would misrepresent the listing.
export function buildJobPostingJsonLd(job) {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.jobTitle,
    description: job.description,
    datePosted: job.createdAtISO,
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

  const employmentType = EMPLOYMENT_TYPE_MAP[job.jobType];
  if (employmentType) jsonLd.employmentType = employmentType;

  const salary = parseSalaryRange(job.salaryRange);
  if (salary) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: salary.currency,
      value: {
        "@type": "QuantitativeValue",
        minValue: salary.minValue,
        maxValue: salary.maxValue,
        unitText: salary.unitText,
      },
    };
  }

  return jsonLd;
}
