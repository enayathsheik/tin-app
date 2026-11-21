// L6: sharing a job — the link, the text that goes with it, the per-network
// share URLs, and the description used in the job page's og/twitter tags
// (scripts/prerender.js and src/pages/JobDetailPage.jsx), so a shared link
// shows the pay and place in its preview. Takes a normaliseJob() result.
// Unit-tested in test/unit/jobShare.test.js.
export const SITE_URL = "https://tinit.in";
export const OG_IMAGE = `${SITE_URL}/og-image.png`; // TIN-branded default, 1200×630
export const OG_IMAGE_ALT = "TIN Jobs — jobs in building materials, construction and interiors";

const truncate = (str, len) => (str && str.length > len ? str.slice(0, len - 1).trimEnd() + "…" : str || "");

export const jobShareUrl = (jobId) => `${SITE_URL}/jobs/${jobId}`;
export const jobOrgName = (job) => job.businessName || job.postedByName || "TIN";

// "₹15,000–22,000 / month · Pune · Full-time" (only the parts the job has).
export function jobShareSummary(job) {
  // Old jobs can carry a bare number ("35000") — show it as ₹35,000.
  const raw = job.payText || "";
  const pay = /^\d{3,}$/.test(raw) ? `₹${Number(raw).toLocaleString("en-IN")}` : raw;
  const place = [job.city, job.state].filter(Boolean)[0] || "";
  const type = (job.workTypeLabels || [])[0] || job.legacyJobType || "";
  return [pay, place, type].filter(Boolean).join(" · ");
}

// og:description / meta description: summary first, then the job text.
export function jobShareDescription(job, max = 160) {
  const body = job.description || (job.responsibilities || []).join(". ");
  const summary = jobShareSummary(job);
  return truncate(summary && body ? `${summary} — ${body}` : summary || body, max);
}

// The message that goes with the link (WhatsApp, X, the phone's share sheet).
export function jobShareText(job) {
  const summary = jobShareSummary(job);
  return `${job.title} at ${jobOrgName(job)}${summary ? ` · ${summary}` : ""}`;
}

export function shareLinks(url, text) {
  const u = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${u}`,
  };
}
