import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CITIES, STATES } from "../data/constants";
import {
  BENEFITS, FUNCS, INDUSTRIES, PAY_DISPLAY, PAY_PERIODS, TRADES, TYPES, URGENCY, labelOf,
} from "../data/jobsTaxonomy.js";
import {
  HIDDEN_PAY, WIZARD_STEPS, draftFromJob, emptyDraft, isShortAssignment, validateStep,
} from "../utils/jobDraft.js";
import { formatPay } from "../utils/jobModel.js";
import { createJob, isVerifiedAccount, loadJobForEdit, loadLinkedStore, updateJob } from "../lib/jobsPost";
import { validatePincode } from "../utils/helpers";
import { JobsStyles } from "../components/jobs/jobsUi";
import { LANE_COLOR, btnOutline, btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { Choice, Field, Pick } from "../components/jobs/WizardFields";

// Per-device autosave so a reload doesn't lose the wizard. Wrapped in
// try/catch: storage can be blocked, and the wizard must still work.
const draftKey = (uid, jobId) => `tinJobDraft:${uid}:${jobId || "new"}`;
const readSaved = (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeSaved = (key, d) => { try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* storage unavailable */ } };
const clearSaved = (key) => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };

const LANE_OPTIONS = [
  { key: "professional", label: "Professional", desc: "Office, showroom, design, sales, management", color: LANE_COLOR.professional },
  { key: "skilled", label: "Skilled workforce", desc: "Site, installation, workshop, trades", color: LANE_COLOR.skilled },
];
const PAY_DISPLAY_OPTIONS = PAY_DISPLAY.map(o => ({ key: o.key, label: o.label }));
const EVP_OPTIONS = [
  { key: "list", label: "Tick a list", desc: "Choose benefits and add details" },
  { key: "write", label: "Write it yourself", desc: "Describe your workplace in your own words" },
];

// /jobs/post (new) and /jobs/:jobId/edit (edit own job). Five steps:
// Business → The job → Pay → Why work with you → Review & publish.
export function PostJobPage({ user, isGuest, onRequireLogin, onListStore, toast }) {
  const { jobId } = useParams();
  const isEdit = !!jobId;
  const navigate = useNavigate();
  const key = user?.uid ? draftKey(user.uid, jobId) : null;
  // Latest user object for the loader, without re-running it on every App
  // re-render (the user object's identity changes; uid / storeId don't).
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const uid = user?.uid;
  const linkedStoreId = user?.storeId;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [store, setStore] = useState(null);
  const [existing, setExisting] = useState(null);
  const [draft, setDraft] = useState(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { id, status, changed }

  // Load: linked store, the job being edited, and any autosaved progress.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const user = userRef.current;
      const linked = await loadLinkedStore(user);
      let job = null;
      if (isEdit) {
        try { job = await loadJobForEdit(jobId); } catch (e) { console.error("[post-job] load failed:", e); }
        if (!job) { if (!cancelled) { setLoadError("This job couldn't be found."); setReady(true); } return; }
        if (job.postedByUid !== user.uid) { if (!cancelled) { setLoadError("You can only edit jobs you posted."); setReady(true); } return; }
      }
      const base = job ? draftFromJob(job, user) : emptyDraft(user, linked);
      if (linked) base.business = { ...base.business, name: linked.storeName || base.business.name };
      const saved = readSaved(draftKey(user.uid, jobId));
      if (cancelled) return;
      setStore(linked);
      setExisting(job);
      setDraft(saved?.draft ? { ...base, ...saved.draft } : base);
      // Editing: every step already has content, so all steps are reachable.
      if (job) setMaxStep(4);
      if (saved?.step) { setStep(saved.step); setMaxStep(Math.max(job ? 4 : 0, saved.maxStep || saved.step)); }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [uid, linkedStoreId, jobId, isEdit]);

  // Autosave on every change.
  useEffect(() => {
    if (key && draft && !done) writeSaved(key, { draft, step, maxStep });
  }, [key, draft, step, maxStep, done]);

  const upd = (path, value) => setDraft(d => {
    const parts = path.split(".");
    if (parts.length === 1) return { ...d, [path]: value };
    return { ...d, [parts[0]]: { ...d[parts[0]], [parts[1]]: value } };
  });
  const errFor = (field) => errors.find(e => e.field === field)?.message;
  const short = draft ? isShortAssignment(draft) : false;
  const verified = isVerifiedAccount(user);

  const goTo = (n) => { setErrors([]); setStep(n); window.scrollTo?.(0, 0); document.querySelector(".tj-scroll")?.scrollTo?.(0, 0); };
  const next = () => {
    const errs = validateStep(step, draft);
    setErrors(errs);
    if (errs.length) return;
    const n = Math.min(step + 1, 4);
    setMaxStep(m => Math.max(m, n));
    goTo(n);
  };

  const submit = async () => {
    for (const s of [0, 1, 2, 4]) {
      const errs = validateStep(s, draft);
      if (errs.length) { setStep(s); setErrors(errs); return; }
    }
    setSaving(true);
    try {
      const result = isEdit ? await updateJob(user, existing, draft, store) : { ...(await createJob(user, draft, store)), changed: true };
      clearSaved(key);
      setDone({ id: isEdit ? existing.id : result.id, status: result.status, changed: result.changed });
      if (result.changed) toast?.(isEdit ? "Changes saved" : (result.status === "approved" ? "Job posted! It's now live." : "Submitted for review"), "ok");
    } catch (e) {
      console.error("[post-job] save failed:", e);
      setErrors([{ field: "_save", message: "Could not save: " + (e.message || e) }]);
    }
    setSaving(false);
  };

  const payPreview = useMemo(() => {
    if (!draft) return "";
    const p = draft.pay;
    const hidden = HIDDEN_PAY.includes(p.display);
    const num = (v) => { const n = parseFloat(String(v).replace(/[,\s₹]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
    return formatPay({ source: "structured", period: p.period, display: p.display, min: hidden ? null : num(p.min), max: hidden ? null : num(p.max), text: draft.legacySalaryText || null }) || "—";
  }, [draft]);

  // ── Guest / loading / error / done screens ─────────────────
  const shell = (children) => (
    <div className="tj-scroll">
      <div className="tj-wrap" style={{ maxWidth: 760 }}>
        <JobsStyles />
        <Helmet><title>{isEdit ? "Edit job" : "Post a job"} | TIN Jobs</title><meta name="robots" content="noindex" /></Helmet>
        <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
          <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / {isEdit ? "Edit job" : "Post a job"}
        </div>
        {children}
      </div>
    </div>
  );

  if (isGuest || !user?.uid) {
    return shell(
      <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
        <h1 style={{ ...heading, fontSize: 24, margin: "0 0 6px" }}>Post a job <span style={{ color: "var(--acc)" }}>free</span></h1>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 14px" }}>Log in or create a free TIN account to post. You'll come straight back here.</p>
        <button onClick={onRequireLogin} style={btnPrimary}>Log in to post a job</button>
      </div>
    );
  }
  if (!ready) return shell(<div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Loading…</div>);
  if (loadError) return shell(<div style={{ ...card, padding: 24, textAlign: "center", color: "var(--t2)" }}>{loadError} <Link to="/jobs" style={{ color: "var(--acc)" }}>Back to Jobs</Link></div>);

  if (done) {
    const live = done.status === "approved";
    return shell(
      <div style={{ ...card, padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
        <h1 style={{ ...heading, fontSize: 24, margin: "0 0 6px" }}>
          {!done.changed ? "No changes to save" : isEdit ? (live ? "Changes are live" : "Changes sent for review") : (live ? "Your job is live" : "Submitted for review")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 auto 16px", maxWidth: 460 }}>
          {!done.changed ? "Everything was already up to date."
            : live ? "It's showing on TIN Jobs now. New applications appear in your Employer Desk."
            : "The TIN team reviews listings from accounts that aren't verified yet. It will show on TIN Jobs once approved."}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/jobs/${done.id}`)} style={btnPrimary}>See the listing</button>
          <button onClick={() => navigate("/jobs")} style={btnOutline}>Back to Jobs</button>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────
  const d = draft;
  const saveError = errFor("_save");
  const steps = (
    <nav aria-label="Steps" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
      {WIZARD_STEPS.map((label, i) => {
        const on = i === step, reachable = i <= maxStep;
        return (
          <button key={label} type="button" disabled={!reachable} onClick={() => reachable && goTo(i)} aria-current={on ? "step" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "6px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              border: `1px solid ${on ? "var(--acc)" : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)",
              color: reachable ? "var(--t1)" : "var(--t3)", cursor: reachable ? "pointer" : "default", opacity: reachable ? 1 : 0.6,
            }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: i < step ? "var(--ok)" : on ? "var(--acc)" : "var(--s2)", color: i <= step ? "#fff" : "var(--t3)" }}>
              {i < step ? "✓" : i + 1}
            </span>
            {label}{i === 3 && <span style={{ fontWeight: 400, color: "var(--t3)" }}> · optional</span>}
          </button>
        );
      })}
    </nav>
  );

  let pane = null;
  if (step === 0) {
    pane = <>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 4px" }}>Your business</h2>
      {store ? <>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Taken from your TIN store profile. Edit it once there and every job uses it.</p>
        <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{store.storeName}</div>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>{[store.businessType, store.city].filter(Boolean).join(" · ")}</div>
          <Link to={`/store/${store.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>View store profile →</Link>
        </div>
      </> : <>
        <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Who's hiring? We'll remember this for your next job.</p>
        <Field label="Business / company name" required error={errFor("business.name")}>
          <input className="fi" value={d.business.name} onChange={e => upd("business.name", e.target.value)} placeholder="e.g. Sai Tiles & Sanitary" />
        </Field>
        <Field label="Business city" optional>
          <input className="fi" list="pj-cities" value={d.business.city} onChange={e => upd("business.city", e.target.value)} placeholder="City" />
        </Field>
      </>}
      <Field label="Industry" required error={errFor("business.industry")}
        hint={d.business.industry ? "Prefilled from your TIN business type where it matches — change it if it's not right." : undefined}>
        <select className="fi" value={d.business.industry} onChange={e => upd("business.industry", e.target.value)}>
          <option value="">Choose your industry</option>
          {INDUSTRIES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Field>
      {!store && (
        <div style={{ fontSize: 12, color: "var(--t3)", background: "var(--s2)", borderRadius: 8, padding: "8px 12px" }}>
          Is your shop or office not on TIN yet?{" "}
          <button type="button" onClick={onListStore} style={{ background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>List your store on TIN</button>
          {" "}— the TIN team can then link it to your account so your jobs show on your store page.
        </div>
      )}
    </>;
  }

  if (step === 1) {
    pane = <>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 4px" }}>The job</h2>
      <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Pick the lane first. The form adjusts for short assignments and crews.</p>
      <Choice options={LANE_OPTIONS} value={d.lane} onChange={v => setDraft(x => ({ ...x, lane: v, functions: x.functions.length ? x.functions : (v === "skilled" ? ["installation_trades"] : []) }))} />
      {d.lane === "skilled" ? <>
        <Field label="Trade / skill" required error={errFor("trade")}>
          <select className="fi" value={d.trade} onChange={e => upd("trade", e.target.value)}>
            <option value="">Choose the trade</option>
            {TRADES.map(t => <option key={t.key} value={t.key}>{t.label} · {t.labelHi}</option>)}
          </select>
        </Field>
        <Field label="Job title" optional hint={d.trade ? `Leave empty to use "${labelOf(TRADES, d.trade)}".` : "e.g. Masons for residential tower"}>
          <input className="fi" value={d.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Masons for residential tower" />
        </Field>
      </> : (
        <Field label="Job title" required error={errFor("title")}>
          <input className="fi" value={d.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Sales Executive — Laminates" />
        </Field>
      )}
      <Field label="Number of people" required error={errFor("headcount")}>
        <input className="fi" type="number" min="1" inputMode="numeric" value={d.headcount} onChange={e => upd("headcount", e.target.value)} style={{ maxWidth: 140 }} />
      </Field>
      <Field label="Function (one or more)" required error={errFor("functions")}>
        <Pick multiple label="Function" options={FUNCS} value={d.functions} onChange={v => upd("functions", v)} accent={LANE_COLOR[d.lane]} />
      </Field>
      <Field label="Work type (all that apply)" required error={errFor("workTypes")}>
        <Pick multiple label="Work type" options={TYPES} value={d.workTypes} onChange={v => upd("workTypes", v)} accent={LANE_COLOR[d.lane]} />
      </Field>
      {short && (
        <div style={{ border: `1px dashed ${LANE_COLOR["needed-now"]}`, borderRadius: "var(--r)", padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--acc)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Short assignment details</div>
          <div className="pj-grid2">
            <Field label="Duration" required error={errFor("shortAssignment.duration")}>
              <input className="fi" value={d.shortAssignment.duration} onChange={e => upd("shortAssignment.duration", e.target.value)} placeholder="e.g. 1 day, 2 weeks" />
            </Field>
            <Field label="Start date" optional>
              <input className="fi" type="date" value={d.shortAssignment.startDate} onChange={e => upd("shortAssignment.startDate", e.target.value)} />
            </Field>
          </div>
          <Field label="How urgent?" optional>
            <Pick label="How urgent" options={URGENCY} value={d.shortAssignment.urgency} onChange={v => upd("shortAssignment.urgency", d.shortAssignment.urgency === v ? "" : v)} accent="var(--acc)" />
          </Field>
          <Field label="Certification or tools needed" optional>
            <input className="fi" value={d.shortAssignment.certTools} onChange={e => upd("shortAssignment.certTools", e.target.value)} placeholder="e.g. Own tools, wiring licence" />
          </Field>
        </div>
      )}
      <div className="pj-grid2">
        <Field label="City" required error={errFor("city")}>
          <input className="fi" list="pj-cities" value={d.city} onChange={e => upd("city", e.target.value)} placeholder="City" />
        </Field>
        <Field label="State" optional>
          <select className="fi" value={d.state} onChange={e => upd("state", e.target.value)}>
            <option value="">Select state</option>
            {STATES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Pincode" optional error={errFor("pincode")}>
          <input className="fi" inputMode="numeric" maxLength={6} value={d.pincode} placeholder="6-digit pincode"
            onChange={e => {
              const pin = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
              upd("pincode", pin);
              if (pin.length === 6) { const r = validatePincode(pin); if (r.valid && r.state && !d.state) upd("state", r.state); }
            }} />
        </Field>
        <Field label="Experience" optional hint='e.g. "Fresher", "2–4 yrs", "5+ yrs"'>
          <input className="fi" value={d.experience} onChange={e => upd("experience", e.target.value)} placeholder="e.g. 2–4 yrs" />
        </Field>
        <Field label="Working hours" optional>
          <input className="fi" value={d.workingHours} onChange={e => upd("workingHours", e.target.value)} placeholder="e.g. 10 am – 7 pm, Mon–Sat" />
        </Field>
        <Field label="Education" optional>
          <input className="fi" value={d.education} onChange={e => upd("education", e.target.value)} placeholder="e.g. Any graduate" />
        </Field>
      </div>
      <Field label="What will they do? (one per line)" required error={errFor("duties")}>
        <textarea className="fta" rows={4} value={d.duties} onChange={e => upd("duties", e.target.value)} placeholder={"Handle walk-in customers\nVisit carpenters and architects"} />
      </Field>
      <Field label="Skills needed" optional hint="Separate with commas.">
        <input className="fi" value={d.skills} onChange={e => upd("skills", e.target.value)} placeholder="e.g. Laminates, customer handling" />
      </Field>
    </>;
  }

  if (step === 2) {
    const hidden = HIDDEN_PAY.includes(d.pay.display);
    pane = <>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 4px" }}>Pay</h2>
      <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Clear pay gets more replies. You can still keep it negotiable.</p>
      <Field label="Paid" required error={errFor("pay.period")}>
        <Pick label="Paid" options={PAY_PERIODS} value={d.pay.period} onChange={v => upd("pay.period", v)} />
      </Field>
      <Field label="Show pay as" required error={errFor("pay.display")}>
        <Pick label="Show pay as" options={PAY_DISPLAY_OPTIONS} value={d.pay.display} onChange={v => upd("pay.display", v)} />
      </Field>
      {hidden ? (
        <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          Your job will show "{PAY_DISPLAY.find(o => o.key === d.pay.display)?.text}". Amounts aren't saved when pay is hidden — only how it's paid.
        </div>
      ) : (
        <div className="pj-grid2">
          <Field label="From (₹)" required error={errFor("pay.min")} hint={d.legacySalaryText ? `Currently shown as "${d.legacySalaryText}". Add an amount to replace it.` : undefined}>
            <input className="fi" inputMode="numeric" value={d.pay.min} onChange={e => upd("pay.min", e.target.value)} placeholder="e.g. 22000" />
          </Field>
          <Field label="To (₹)" optional error={errFor("pay.max")}>
            <input className="fi" inputMode="numeric" value={d.pay.max} onChange={e => upd("pay.max", e.target.value)} placeholder="e.g. 28000" />
          </Field>
        </div>
      )}
      <Field label="Incentives, allowances, other facilities" optional>
        <input className="fi" value={d.pay.incentives} onChange={e => upd("pay.incentives", e.target.value)} placeholder="e.g. 2% on monthly sales above target" />
      </Field>
      <div style={{ fontSize: 12, color: "var(--t3)" }}>Shows on your job as: <b style={{ color: "var(--acc)" }}>{payPreview}</b></div>
    </>;
  }

  if (step === 3) {
    pane = <>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 4px" }}>Why should someone choose to work with you?</h2>
      <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Optional. Tick only what's true today — two honest benefits beat a long list.</p>
      <Choice options={EVP_OPTIONS} value={d.evpMode} onChange={v => upd("evpMode", v)} />
      {d.evpMode === "write" ? (
        <Field label="Your workplace" optional>
          <textarea className="fta" rows={6} value={d.evpText} onChange={e => upd("evpText", e.target.value)} placeholder="Tell candidates about your workplace, benefits and growth opportunities." />
        </Field>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {BENEFITS.map(b => {
            const on = d.benefits[b.key] !== undefined;
            return (
              <div key={b.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: on ? "var(--s2)" : "transparent" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--t1)", cursor: "pointer", minWidth: 220 }}>
                  <input type="checkbox" checked={on} onChange={e => setDraft(x => {
                    const benefits = { ...x.benefits };
                    if (e.target.checked) benefits[b.key] = ""; else delete benefits[b.key];
                    return { ...x, benefits };
                  })} />
                  {b.label}
                </label>
                {on && <input className="fi" style={{ flex: 1, minWidth: 180 }} value={d.benefits[b.key]} placeholder="Details (optional)"
                  onChange={e => setDraft(x => ({ ...x, benefits: { ...x.benefits, [b.key]: e.target.value } }))} />}
              </div>
            );
          })}
        </div>
      )}
    </>;
  }

  if (step === 4) {
    const ben = Object.keys(d.benefits).map(k => labelOf(BENEFITS, k));
    const row = (label, value) => value ? (<><dt style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</dt><dd style={{ margin: "0 0 8px", fontSize: 13, color: "var(--t1)" }}>{value}</dd></>) : null;
    pane = <>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 4px" }}>Check and {isEdit ? "save" : "publish"}</h2>
      <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>Posting is free. You can edit or close the job anytime from your Employer Desk.</p>
      <dl style={{ margin: "0 0 12px" }}>
        {row("Business", [d.business.name, labelOf(INDUSTRIES, d.business.industry)].filter(Boolean).join(" · "))}
        {row("Lane", d.lane === "skilled" ? "Skilled workforce" : "Professional")}
        {row("Role", `${d.title || labelOf(TRADES, d.trade) || "—"} · ${d.headcount || 1} ${Number(d.headcount) > 1 ? "people" : "person"}`)}
        {row("Function", d.functions.map(k => labelOf(FUNCS, k)).join(", "))}
        {row("Work type", d.workTypes.map(k => labelOf(TYPES, k)).join(", "))}
        {short && row("Assignment", [d.shortAssignment.duration, d.shortAssignment.startDate && `from ${d.shortAssignment.startDate}`, d.shortAssignment.urgency && labelOf(URGENCY, d.shortAssignment.urgency)].filter(Boolean).join(" · "))}
        {row("Location", [d.city, d.state, d.pincode].filter(Boolean).join(", "))}
        {row("Experience", d.experience)}
        {row("Pay", payPreview + (d.pay.incentives && !HIDDEN_PAY.includes(d.pay.display) ? ` · ${d.pay.incentives}` : ""))}
        {row("Why join", d.evpMode === "write" ? d.evpText : ben.join(", "))}
      </dl>
      <Field label="Contact phone" required error={errFor("contactPhone")} hint="Used by TIN to reach you about this listing.">
        <input className="fi" value={d.contactPhone} onChange={e => upd("contactPhone", e.target.value)} placeholder="Your mobile number" />
      </Field>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
        <input type="checkbox" checked={d.notAgencyDeclaration} onChange={e => upd("notAgencyDeclaration", e.target.checked)} style={{ marginTop: 2 }} />
        <span>I confirm this is a direct hiring listing and I am not a recruitment/staffing agency. <span style={{ color: "#e85a2a" }}>*</span></span>
      </label>
      {errFor("notAgencyDeclaration") && <div role="alert" style={{ fontSize: 11, color: "#dc2626", marginBottom: 8 }}>⚠ {errFor("notAgencyDeclaration")}</div>}
      <div style={{ fontSize: 12, color: verified ? "#15803d" : "#b45309", background: verified ? "#f0fdf4" : "#fffbeb", border: `1px solid ${verified ? "#bbf7d0" : "#fde68a"}`, borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
        {verified
          ? (isEdit ? "Your account is verified — changes go live straight away." : "Your account is verified — this job goes live straight away.")
          : (isEdit && existing?.status === "approved" ? "Your account isn't verified yet, so the TIN team re-checks edited jobs. It will be hidden until approved again."
            : "Listings from accounts that aren't verified yet are reviewed by the TIN team before going live.")}
      </div>
    </>;
  }

  return shell(<>
    <h1 style={{ ...heading, fontSize: 26, margin: "0 0 2px" }}>{isEdit ? "Edit job" : <>Post a job <span style={{ color: "var(--acc)" }}>free</span></>}</h1>
    <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>From one helper for a day to a regional head. Five short steps.</p>
    <style>{`.pj-grid2{display:grid;grid-template-columns:1fr;gap:0 12px}@media (min-width:600px){.pj-grid2{grid-template-columns:1fr 1fr}}`}</style>
    <datalist id="pj-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
    {steps}
    <form onSubmit={e => { e.preventDefault(); if (step < 4) next(); else submit(); }} noValidate style={{ ...card, padding: 18 }}>
      {pane}
      {errors.length > 0 && !saveError && <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>Please fix the highlighted fields.</div>}
      {saveError && <div role="alert" style={{ fontSize: 12, color: "#dc2626", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>⚠ {saveError}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {step > 0 ? <button type="button" onClick={() => goTo(step - 1)} style={btnOutline}>← Back</button> : <span />}
        <span style={{ display: "flex", gap: 8 }}>
          {step === 3 && <button type="button" onClick={() => { setMaxStep(m => Math.max(m, 4)); goTo(4); }} style={btnOutline}>Skip</button>}
          <button type="submit" disabled={saving} style={{ ...btnPrimary, padding: "9px 18px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : step < 4 ? "Continue →" : isEdit ? "Save changes" : (verified ? "Publish job" : "Submit for review")}
          </button>
        </span>
      </div>
    </form>
  </>);
}
