// L9: Admin → Pricing. Job-seeker profile fee and job-post fee (list price,
// offer price, Launch discount toggle: ON = ₹0) and the per-job shortlist
// limit (L10). Saved to config/pricing — only the TIN admin can write it
// (firestore.rules). No payments yet: this only changes what screens show and
// what each free profile / job post records as its entitlement.
import { useEffect, useState } from "react";
import { clearPricingCache, loadPricing, savePricing } from "../../lib/pricing";
import { clearShortlistLimitCache } from "../../lib/shortlist";
import { priceDisplay, validatePricing } from "../../utils/pricing.js";

const box = { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16, marginBottom: 14, maxWidth: 640 };
const inp = { width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 };
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 };

function FeeEditor({ title, value, onChange, errFor }) {
  const d = priceDisplay({ list: Number(value.list) || 0, offer: Number(value.offer) || 0, launchDiscount: !!value.launchDiscount });
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        <label><span style={lbl}>List price (₹)</span><input style={inp} inputMode="numeric" value={value.list} onChange={e => onChange({ ...value, list: e.target.value })} /></label>
        <label><span style={lbl}>Offer price (₹)</span><input style={inp} inputMode="numeric" value={value.offer} onChange={e => onChange({ ...value, offer: e.target.value })} /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={!!value.launchDiscount} onChange={e => onChange({ ...value, launchDiscount: e.target.checked })} />
        <span><b>Launch discount</b> — ON = ₹0 (“Free during launch”)</span>
      </label>
      {[errFor("list"), errFor("offer")].filter(Boolean).map(m => <div key={m} role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>⚠ {m}</div>)}
      <div style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
        Users see: {d.struck != null && <s>₹{d.struck.toLocaleString("en-IN")}</s>} <b>{d.label}</b>
      </div>
    </div>
  );
}

export function PricingSection({ user }) {
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [state, setState] = useState({ saving: false, saved: false, error: "" });

  useEffect(() => {
    let c = false;
    loadPricing({ fresh: true }).then(p => { if (!c) setForm(p); });
    return () => { c = true; };
  }, []);

  if (!form) return <div style={{ color: "#777" }}>Loading…</div>;

  const errFor = (key) => (part) => errors.find(e => e.field === `${key}.${part}`)?.message;
  const save = async () => {
    const errs = validatePricing(form);
    setErrors(errs);
    if (errs.length) return;
    setState({ saving: true, saved: false, error: "" });
    try {
      const clean = await savePricing(form, user?.uid);
      clearPricingCache(); clearShortlistLimitCache();
      setForm(clean);
      setState({ saving: false, saved: true, error: "" });
    } catch (e) {
      console.error("[pricing] save failed:", e);
      setState({ saving: false, saved: false, error: e.message || String(e) });
    }
  };

  return (
    <>
      <div className="admin-hd">
        <div className="admin-title">Pricing</div>
        <div className="admin-sub">No payments yet. These prices show on the profile and post-job screens, and are recorded with each free profile / job post (valid 365 days). Only the TIN admin can change them.</div>
      </div>
      <FeeEditor title="Job-seeker profile fee" value={form.profileFee} onChange={v => setForm({ ...form, profileFee: v })} errFor={errFor("profileFee")} />
      <FeeEditor title="Job-post fee" value={form.jobPostFee} onChange={v => setForm({ ...form, jobPostFee: v })} errFor={errFor("jobPostFee")} />
      <div style={box}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Shortlist limit</div>
        <label><span style={lbl}>Shortlists per job post</span><input style={inp} inputMode="numeric" value={form.shortlistLimit} onChange={e => setForm({ ...form, shortlistLimit: e.target.value })} /></label>
        {errors.find(e => e.field === "shortlistLimit") && <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>⚠ {errors.find(e => e.field === "shortlistLimit").message}</div>}
        <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>Applies to every job, always — whatever the price or discount. An applicant counts once, the first time they're shortlisted. Lowering it never takes back shortlists already used.</div>
        <label style={{ display: "block", marginTop: 14 }}><span style={lbl}>Shortlists from search, per employer per day</span><input style={inp} inputMode="numeric" value={form.searchShortlistDailyLimit} onChange={e => setForm({ ...form, searchShortlistDailyLimit: e.target.value })} /></label>
        {errors.find(e => e.field === "searchShortlistDailyLimit") && <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>⚠ {errors.find(e => e.field === "searchShortlistDailyLimit").message}</div>}
        <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>How many new people one employer can shortlist from Find candidates in a day, across all their jobs. People who applied don’t count. 0 switches it off.</div>
      </div>
      <button type="button" disabled={state.saving} onClick={save}
        style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
        {state.saving ? "Saving…" : "Save pricing"}
      </button>
      {state.saved && <span role="status" style={{ marginLeft: 12, color: "#15803d", fontSize: 13 }}>✓ Saved</span>}
      {state.error && <div role="alert" style={{ marginTop: 10, color: "#b91c1c", fontSize: 13 }}>⚠ {state.error}</div>}
    </>
  );
}
