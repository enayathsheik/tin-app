// L9: the price line on the profile and post-job screens — struck-out list
// price and "Free during launch" while the admin's Launch discount is on
// (Admin → Pricing). No payments yet.
import { useEffect, useState } from "react";
import { loadPricing } from "../../lib/pricing";
import { priceDisplay } from "../../utils/pricing.js";

export function PriceTag({ kind, style }) {
  const [pricing, setPricing] = useState(null);
  useEffect(() => { let c = false; loadPricing().then(p => { if (!c) setPricing(p); }); return () => { c = true; }; }, []);
  if (!pricing) return null;
  const fee = kind === "jobPost" ? pricing.jobPostFee : pricing.profileFee;
  const d = priceDisplay(fee);
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, fontSize: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "4px 10px", ...style }}>
      {d.struck != null && <s style={{ color: "var(--t3)" }}>₹{d.struck.toLocaleString("en-IN")}</s>}
      <b style={{ color: d.now === 0 ? "#15803d" : "var(--t1)" }}>{d.label}</b>
      <span style={{ fontSize: 11, color: "var(--t3)" }}>{kind === "jobPost" ? "per job post · 365 days" : "job-seeker profile · 365 days"}</span>
    </div>
  );
}
