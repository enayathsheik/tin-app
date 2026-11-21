// L2b: the owner completes their store / studio profile after the TIN admin
// approves their claim (or for a store they added). firestore.rules
// (match /stores) lets the store's contributorId edit its details but never
// its verification or claim fields — this page only writes EDITABLE_FIELDS.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { BUSINESS_TYPES, CITIES, STATES } from "../data/constants";
import { Field } from "../components/jobs/WizardFields";
import { btnOutline, btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { isValidGstin, isValidIndianMobile, normalisePhone } from "../utils/storeClaim.js";

const EDITABLE_FIELDS = ["storeName", "businessType", "about", "ownerName", "phone", "whatsapp", "email",
  "address", "city", "state", "pincode", "gst", "brands", "website", "instagram"];

export function StoreEditPage({ user, isGuest, onRequireLogin }) {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", store: null });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "stores", storeId)).then(snap => {
      if (cancelled) return;
      if (!snap.exists()) { setState({ loading: false, error: "This store couldn't be found.", store: null }); return; }
      const store = { id: snap.id, ...snap.data() };
      if (store.contributorId !== uid) { setState({ loading: false, error: "Only the owner of this business can edit its profile.", store: null }); return; }
      setForm(Object.fromEntries(EDITABLE_FIELDS.map(k => [k, store[k] ?? ""])));
      setState({ loading: false, error: "", store });
    }).catch(e => {
      console.error("[store-edit] load failed:", e);
      if (!cancelled) setState({ loading: false, error: "This store couldn't be loaded.", store: null });
    });
    return () => { cancelled = true; };
  }, [storeId, uid]);

  if (isGuest) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Log in to edit your business profile.</div>
        <button type="button" onClick={onRequireLogin} style={btnPrimary}>Log in</button>
      </div>
    );
  }
  if (state.loading) return <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>Loading…</div>;
  if (state.error) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 8 }}>{state.error}</div>
        <Link to="/jobs" style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}>← Back to Jobs</Link>
      </div>
    );
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.storeName.trim()) errs.storeName = "Enter the business name.";
    if (!form.city.trim()) errs.city = "Enter the city.";
    if (form.phone && !isValidIndianMobile(form.phone)) errs.phone = "Enter a 10-digit mobile number.";
    if (form.whatsapp && !isValidIndianMobile(form.whatsapp)) errs.whatsapp = "Enter a 10-digit WhatsApp number.";
    if (form.pincode && !/^\d{6}$/.test(form.pincode.trim())) errs.pincode = "Enter a 6-digit pincode.";
    if (form.gst && !isValidGstin(form.gst)) errs.gst = "That GST number doesn't look right (15 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true); setSaveError("");
    try {
      const clean = Object.fromEntries(EDITABLE_FIELDS.map(k => [k, String(form[k] ?? "").trim()]));
      if (clean.phone) clean.phone = normalisePhone(clean.phone);
      if (clean.whatsapp) clean.whatsapp = normalisePhone(clean.whatsapp);
      clean.gst = clean.gst.toUpperCase();
      await updateDoc(doc(db, "stores", storeId), { ...clean, updatedAt: serverTimestamp() });
      navigate(`/store/${storeId}`);
    } catch (err) {
      console.error("[store-edit] save failed:", err);
      setSaveError("Your changes couldn't be saved. Please try again.");
    }
    setSaving(false);
  };

  const input = (k, props = {}) => <input className="fi" value={form[k]} onChange={e => upd(k, e.target.value)} {...props} />;

  return (
    <div style={{ height: "100%", width: "100%", overflowY: "auto" }}>
      <form onSubmit={save} style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 100px" }}>
        <h1 style={{ ...heading, fontSize: 24, margin: "0 0 4px" }}>Your business profile</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 14px" }}>This is what job seekers see on your business page and next to your jobs.</p>
        <div style={{ ...card, padding: 16 }}>
          <Field label="Business / studio name" required error={errors.storeName}>{input("storeName")}</Field>
          <Field label="Type of business">
            <select className="fi" value={form.businessType} onChange={e => upd("businessType", e.target.value)}>
              <option value="">Choose</option>
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="About the business" optional hint="What you sell or do, since when, how big the team is.">
            <textarea className="fi" rows={4} value={form.about} onChange={e => upd("about", e.target.value)} maxLength={1000} />
          </Field>
          <Field label="Owner name" optional>{input("ownerName")}</Field>
          <Field label="Business phone" optional error={errors.phone}>{input("phone", { inputMode: "tel" })}</Field>
          <Field label="WhatsApp" optional error={errors.whatsapp}>{input("whatsapp", { inputMode: "tel" })}</Field>
          <Field label="Email" optional>{input("email", { type: "email" })}</Field>
          <Field label="Address" optional>{input("address")}</Field>
          <Field label="City" required error={errors.city}>{input("city", { list: "se-cities" })}</Field>
          <Field label="State" optional>
            <select className="fi" value={form.state} onChange={e => upd("state", e.target.value)}>
              <option value="">Choose</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pincode" optional error={errors.pincode}>{input("pincode", { inputMode: "numeric" })}</Field>
          <Field label="GST number" optional error={errors.gst}>{input("gst")}</Field>
          <Field label="Brands you sell or work with" optional>{input("brands")}</Field>
          <Field label="Website" optional>{input("website")}</Field>
          <Field label="Instagram" optional>{input("instagram")}</Field>
        </div>
        {saveError && <div role="alert" style={{ fontSize: 12, color: "#dc2626", margin: "10px 0" }}>⚠ {saveError}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>{saving ? "Saving…" : "Save profile"}</button>
          <Link to={`/store/${storeId}`} style={{ ...btnOutline, textDecoration: "none" }}>Cancel</Link>
        </div>
        <datalist id="se-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
      </form>
    </div>
  );
}
