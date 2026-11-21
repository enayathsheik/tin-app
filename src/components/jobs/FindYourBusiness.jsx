// L2b "Find your business" (Post a Job, account with no linked store):
// search all stores by name + city — including imported stores hidden from the
// public site — claim one (TIN admin approves, see admin "Business Claims"),
// or fall back to the normal "List your store" register flow.
import { useEffect, useState } from "react";
import { Field } from "./WizardFields";
import { btnOutline, btnPrimary } from "./jobsStyle";
import { loadMyClaims, searchStoresForClaim, submitStoreClaim } from "../../lib/storeClaims";
import { validateClaim } from "../../utils/storeClaim.js";

const box = { fontSize: 12, color: "var(--t3)", background: "var(--s2)", borderRadius: 8, padding: "10px 12px", marginTop: 4 };
// Enter in a text field runs `fn` and never reaches the Post a Job wizard form.
const onEnter = (fn) => (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }
};
const linkBtn = { background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontSize: 12 };

export function FindYourBusiness({ user, onListStore, defaultName = "", defaultCity = "" }) {
  const [claims, setClaims] = useState(null); // null = loading
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [city, setCity] = useState(defaultCity);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", phoneConfirmed: false, gst: "", email: user?.email || "" });
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadMyClaims(uid)
      .then(list => { if (!cancelled) setClaims(list); })
      .catch(e => { console.error("[find-business] Could not load claims:", e); if (!cancelled) setClaims([]); });
    return () => { cancelled = true; };
  }, [uid]);

  const pending = claims?.find(c => c.status === "pending");
  const lastRejected = claims?.[0]?.status === "rejected" ? claims[0] : null;

  const runSearch = async (e) => {
    e?.preventDefault();
    if (!name.trim() || !city.trim()) { setSearchError("Enter the business name and city."); return; }
    setSearching(true); setSearchError(""); setResults(null); setPicked(null);
    try {
      setResults(await searchStoresForClaim(name, city));
    } catch (err) {
      console.error("[find-business] Search failed:", err);
      setSearchError("Search didn't work just now. Please try again.");
    }
    setSearching(false);
  };

  const submit = async (e) => {
    e?.preventDefault();
    const errs = validateClaim(form);
    setErrors(errs);
    if (errs.length) return;
    setSubmitting(true); setSubmitError("");
    try {
      await submitStoreClaim(user, picked, form);
      setClaims(await loadMyClaims(uid));
      setOpen(false); setPicked(null); setResults(null);
    } catch (err) {
      console.error("[find-business] Claim failed:", err);
      setSubmitError("Your claim couldn't be sent. If this business was just claimed by someone else, contact the TIN team.");
    }
    setSubmitting(false);
  };

  const errFor = (f) => errors.find(x => x.field === f)?.message;
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (claims === null) return null;

  if (pending) {
    return (
      <div style={box}>
        <strong style={{ color: "var(--t1)" }}>Claim sent for {pending.storeName}{pending.storeCity ? `, ${pending.storeCity}` : ""}.</strong>{" "}
        The TIN team will check it and link the business to your account. You can post this job now — it will show on your business page once the claim is approved.
      </div>
    );
  }

  if (!open) {
    return (
      <div style={box}>
        {lastRejected && <div style={{ marginBottom: 6 }}>Your claim for {lastRejected.storeName} was not approved. Contact the TIN team if you think this is a mistake.</div>}
        Is your shop or office already on TIN?{" "}
        <button type="button" onClick={() => setOpen(true)} style={linkBtn}>Find your business</button>
        {" "}· Not on TIN?{" "}
        <button type="button" onClick={onListStore} style={linkBtn}>List your store</button>
      </div>
    );
  }

  return (
    <div style={{ ...box, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 8 }}>Find your business</div>

      {!picked && <>
        {/* Not a <form>: Post a Job wraps its whole wizard in one, and nested
            forms make Enter submit the wizard. Enter is handled here instead. */}
        <div onKeyDown={onEnter(runSearch)}>
          <Field label="Business name" hint="Start of the name is enough, e.g. “Sai Tiles”.">
            <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Business name" />
          </Field>
          <Field label="City">
            <input className="fi" list="pj-cities" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
          </Field>
          {searchError && <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>⚠ {searchError}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={runSearch} disabled={searching} style={btnPrimary}>{searching ? "Searching…" : "Search"}</button>
            <button type="button" onClick={() => setOpen(false)} style={btnOutline}>Cancel</button>
          </div>
        </div>

        {results && (
          <div style={{ marginTop: 12 }}>
            {results.length === 0
              ? <div>No business found with that name in {city}.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.map(s => (
                    <div key={s.id} style={{ background: "#fff", border: "1px solid var(--b1)", borderRadius: 8, padding: "8px 10px", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13 }}>{s.storeName}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{[s.businessType, s.address, s.city].filter(Boolean).join(" · ")}</div>
                      </div>
                      {s.claimedByUid
                        ? <span style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>Already claimed</span>
                        : <button type="button" onClick={() => setPicked(s)} style={{ ...btnOutline, whiteSpace: "nowrap" }}>This is mine</button>}
                    </div>
                  ))}
                </div>}
            <div style={{ marginTop: 10 }}>
              Not in the list?{" "}
              <button type="button" onClick={onListStore} style={linkBtn}>Register your business on TIN</button>
            </div>
          </div>
        )}
      </>}

      {picked && (
        <div onKeyDown={onEnter(submit)}>
          <div style={{ background: "#fff", border: "1px solid var(--b1)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13 }}>{picked.storeName}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{[picked.address, picked.city].filter(Boolean).join(" · ")}</div>
          </div>
          <Field label="Your name" required error={errFor("name")}>
            <input className="fi" value={form.name} onChange={e => upd("name", e.target.value)} />
          </Field>
          <Field label="Your mobile number" required error={errFor("phone")} hint="The TIN team may call this number to check the claim.">
            <input className="fi" inputMode="tel" value={form.phone} onChange={e => upd("phone", e.target.value)} placeholder="10-digit mobile" />
          </Field>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--t1)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.phoneConfirmed} onChange={e => upd("phoneConfirmed", e.target.checked)} style={{ marginTop: 2 }} />
              <span>This is my number, and I own or manage this business.</span>
            </label>
            {errFor("phoneConfirmed") && <div role="alert" style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠ {errFor("phoneConfirmed")}</div>}
          </div>
          <Field label="GST number" optional error={errFor("gst")} hint="Helps us approve faster. Leave empty if you don't have one.">
            <input className="fi" value={form.gst} onChange={e => upd("gst", e.target.value.toUpperCase())} placeholder="e.g. 27ABCDE1234F1Z5" />
          </Field>
          <Field label="Email" optional>
            <input className="fi" type="email" value={form.email} onChange={e => upd("email", e.target.value)} />
          </Field>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>False claims may lead to your account being suspended.</div>
          {submitError && <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>⚠ {submitError}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={submit} disabled={submitting} style={btnPrimary}>{submitting ? "Sending…" : "Send claim"}</button>
            <button type="button" onClick={() => setPicked(null)} style={btnOutline}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
