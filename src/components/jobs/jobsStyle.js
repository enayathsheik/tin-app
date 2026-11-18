// Shared look for the Jobs pages — built only from TIN's existing tokens
// (var(--s1), var(--s2), var(--b2), var(--t1..t3), var(--acc), var(--ok),
// var(--info), var(--warn), var(--r)) and the same inline-style patterns as
// the original JobsPage / PostJobModal. Components live in jobsUi.jsx.
import { PAY_DISPLAY } from "../../data/jobsTaxonomy.js";

export const LANE_COLOR = {
  professional: "var(--info)",
  skilled: "var(--warn)",
  "needed-now": "var(--acc)",
};
export const LANE_LABEL = {
  professional: "Professional",
  skilled: "Skilled workforce",
  "needed-now": "Needed now",
};

export const card = {
  background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)",
};
export const chip = {
  fontSize: 11, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap",
};
export const fieldLabel = {
  fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4,
};
export const heading = {
  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, color: "var(--t1)",
};
export const btnPrimary = {
  padding: "8px 14px", borderRadius: 8, background: "#e85a2a", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
export const btnMuted = {
  padding: "8px 14px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 12, fontWeight: 700, cursor: "default",
};
export const btnOutline = {
  padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)", fontSize: 12, fontWeight: 700, cursor: "pointer",
};

// Pay line for a normalised job: the payText plus incentives. Never shows
// numbers for Negotiable / Don't disclose (formatPay already handles that).
export function payLine(job) {
  if (!job.payText) return null;
  const hidden = PAY_DISPLAY.some(d => d.text && d.key === job.pay?.display);
  return job.pay?.incentives && !hidden ? `${job.payText} · ${job.pay.incentives}` : job.payText;
}
