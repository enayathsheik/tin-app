import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AVAIL, EDU, FUNCS, VISIBILITY, labelOf, workTypesForLane } from "../data/jobsTaxonomy.js";
import { AVAIL_HI, WORK_TYPE_HI, t } from "../data/jobsHindi.js";
import { DEFAULT_VISIBILITY } from "../utils/jobProfile.js";
import { loadJobProfile, saveJobProfile, uploadProfileCv, validateCvFile } from "../lib/jobProfiles";
import { JobsStyles } from "../components/jobs/jobsUi";
import { LANE_COLOR, btnOutline, btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { Field, Pick } from "../components/jobs/WizardFields";
import { TradeTiles } from "../components/jobs/TradeTiles";

const STEPS = [["About you", "आपके बारे में"], ["Your work", "आपका काम"], ["What you want", "कैसा काम चाहिए"], ["Availability", "कब से"]];
const big = { fontSize: 16, padding: "12px 14px", minHeight: 48 };
const VIS_NOTE = {
  not_discoverable: "Hidden from employer search. You can still apply to jobs.",
  default: "Employers on TIN can find your profile (name, work, area) — never your number. Your number is shared only with employers you apply to.",
};

// /jobs/profile — the candidate's job profile ("Find work"). 4 steps; the
// first two hold the basics needed to apply, the last two are optional and
// can be skipped and finished later. Skilled lane: bilingual, big tiles.
export function JobProfilePage({ user, isGuest, onRequireLogin, toast }) {
  const navigate = useNavigate();
  const [pr, setPr] = useState(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    loadJobProfile(user).then(p => { if (!cancelled) setPr(p); }).catch(e => { console.error("[job-profile] load failed:", e); if (!cancelled) setPr({ error: true }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per account
  }, [uid]);

  const shell = (children) => (
    <div className="tj-scroll"><div className="tj-wrap" style={{ maxWidth: 720 }}>
      <JobsStyles />
      <Helmet><title>My job profile | TIN Jobs</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
        <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / My job profile
      </div>
      {children}
    </div></div>
  );

  if (isGuest || !uid) {
    return shell(<div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
      <h1 style={{ ...heading, fontSize: 24, margin: "0 0 6px" }}>Find work · <span lang="hi">काम खोजें</span></h1>
      <p style={{ fontSize: 14, color: "var(--t3)" }}>Log in or create a free TIN account to make your job profile.</p>
      <button onClick={onRequireLogin} style={{ ...btnPrimary, minHeight: 48, fontSize: 15 }}>Log in · लॉग इन</button>
    </div>);
  }
  if (!pr) return shell(<div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Loading…</div>);
  if (pr.error) return shell(<div role="alert" style={{ ...card, padding: 20, color: "#b91c1c" }}>Couldn't load your profile. Please refresh.</div>);

  const bi = pr.lane === "skilled";
  const upd = (k, v) => setPr(p => ({ ...p, [k]: v }));
  const err = (k) => errors[k];

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!pr.lane) e.lane = bi ? "चुनें · Choose one" : "Choose one.";
      if (!pr.name.trim()) e.name = "Add your name.";
      if (pr.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number.";
      if (!pr.city.trim()) e.city = "Add your city.";
    }
    if (s === 1) {
      if (pr.lane === "skilled" && !pr.trades.length) e.trades = "चुनें · Tap at least one trade.";
      if (pr.lane !== "skilled" && !pr.role.trim()) e.role = "Add your current role or designation.";
      if (pr.experienceYears && !/^\d{1,2}(\.\d)?$/.test(String(pr.experienceYears).trim())) e.experienceYears = "Years as a number, e.g. 3";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async ({ finish = false } = {}) => {
    if (!validate(0)) { setStep(0); return; }
    if (!validate(1)) { setStep(1); return; }
    setSaving(true);
    try {
      let next = pr;
      if (cvFile) {
        const ve = validateCvFile(cvFile);
        if (ve) { setErrors({ cv: ve }); setSaving(false); return; }
        next = { ...pr, cv: await uploadProfileCv(uid, cvFile) };
        setCvFile(null);
      }
      await saveJobProfile(uid, next, { isNew: !pr.exists });
      setPr({ ...next, exists: true });
      setSavedOnce(true);
      toast?.(bi ? "सेव हो गया · Saved" : "Profile saved", "ok");
      if (finish) navigate("/jobs/applications");
    } catch (e) {
      console.error("[job-profile] save failed:", e);
      setErrors({ save: "Couldn't save: " + (e.message || e) });
    }
    setSaving(false);
  };

  const goNext = () => { if (validate(step)) setStep(s => Math.min(3, s + 1)); };

  const laneCards = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
      {[["professional", "Professional", "Sales, design, engineering, accounts, management", ""],
        ["skilled", "Skilled trade", "Mason, electrician, carpenter, fabricator…", "कारीगर · मिस्त्री · फिटर"]].map(([k, l, d, hi]) => {
        const on = pr.lane === k;
        return (
          <button type="button" key={k} onClick={() => upd("lane", k)} aria-pressed={on}
            style={{ textAlign: "left", padding: 14, minHeight: 88, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
              border: `2px solid ${on ? LANE_COLOR[k] : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--t1)" }}>{on ? "✓ " : ""}{l}</div>
            {hi && <div lang="hi" style={{ fontSize: 15, color: LANE_COLOR.skilled, fontWeight: 700 }}>{hi}</div>}
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{d}</div>
          </button>
        );
      })}
    </div>
  );

  let pane;
  if (step === 0) {
    pane = <>
      {laneCards}
      {err("lane") && <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginTop: -6, marginBottom: 8 }}>⚠ {err("lane")}</div>}
      <Field label={t("yourName", bi)} required error={err("name")}><input className="fi" style={big} value={pr.name} onChange={e => upd("name", e.target.value)} autoComplete="name" /></Field>
      <Field label={t("mobile", bi)} required error={err("phone")} hint={t("phonePrivate", bi)}><input className="fi" style={big} inputMode="tel" value={pr.phone} onChange={e => upd("phone", e.target.value)} placeholder="98xxxxxx10" /></Field>
      <Field label={t("city", bi)} required error={err("city")}><input className="fi" style={big} value={pr.city} onChange={e => upd("city", e.target.value)} placeholder="e.g. Thane" /></Field>
      <Field label={t("workAreas", bi)} optional><input className="fi" style={big} value={pr.areas} onChange={e => upd("areas", e.target.value)} placeholder="e.g. Thane, Navi Mumbai" /></Field>
      {!bi && <Field label="Email" optional hint="For updates. Shared only with employers you apply to."><input className="fi" type="email" value={pr.email} onChange={e => upd("email", e.target.value)} /></Field>}
    </>;
  } else if (step === 1) {
    pane = pr.lane === "skilled" ? <>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", marginBottom: 8 }}>{t("pickTrades", true)} <span style={{ color: "#e85a2a" }}>*</span></div>
      <TradeTiles value={pr.trades} onChange={v => upd("trades", v)} />
      {err("trades") && <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>⚠ {err("trades")}</div>}
      <div style={{ height: 12 }} />
      <Field label={t("experience", true)} optional error={err("experienceYears")}><input className="fi" style={{ ...big, maxWidth: 160 }} inputMode="numeric" value={pr.experienceYears} onChange={e => upd("experienceYears", e.target.value)} placeholder="e.g. 5" /></Field>
      <Field label={t("languages", true)} optional><input className="fi" style={big} value={pr.languages} onChange={e => upd("languages", e.target.value)} placeholder="e.g. Hindi, Marathi" /></Field>
      <Field label={t("workDone", true)} optional><textarea className="fta" rows={3} value={pr.projects} onChange={e => upd("projects", e.target.value)} placeholder="e.g. Plaster and blockwork for 3 towers" /></Field>
    </> : <>
      <Field label="Current role / designation" required error={err("role")}><input className="fi" value={pr.role} onChange={e => upd("role", e.target.value)} placeholder="e.g. Senior Sales Executive" /></Field>
      <Field label="Total experience (years)" optional error={err("experienceYears")}><input className="fi" inputMode="numeric" style={{ maxWidth: 160 }} value={pr.experienceYears} onChange={e => upd("experienceYears", e.target.value)} /></Field>
      <Field label="Function (one or more)" optional><Pick multiple label="Function" options={FUNCS} value={pr.functions} onChange={v => upd("functions", v)} accent={LANE_COLOR.professional} /></Field>
      <Field label="Skills & software" optional hint="Separate with commas."><input className="fi" value={pr.skills} onChange={e => upd("skills", e.target.value)} placeholder="e.g. AutoCAD, dealer management" /></Field>
      <div className="pj-grid2">
        <Field label="Education" optional>
          <select className="fi" value={pr.education} onChange={e => upd("education", e.target.value)}>
            <option value="">Select</option>{EDU.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Degree / course" optional><input className="fi" value={pr.educationText} onChange={e => upd("educationText", e.target.value)} placeholder="e.g. B.Com, University of Mumbai" /></Field>
      </div>
      <Field label="Languages" optional><input className="fi" value={pr.languages} onChange={e => upd("languages", e.target.value)} placeholder="e.g. Hindi, Marathi, English" /></Field>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Work history (optional)</div>
      {pr.history.map((h, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <input className="fi" style={{ flex: "2 1 140px" }} value={h.role} placeholder="Role" onChange={e => upd("history", pr.history.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
          <input className="fi" style={{ flex: "2 1 140px" }} value={h.org} placeholder="Company" onChange={e => upd("history", pr.history.map((x, j) => j === i ? { ...x, org: e.target.value } : x))} />
          <input className="fi" style={{ flex: "1 1 90px" }} value={h.years} placeholder="2021 – now" onChange={e => upd("history", pr.history.map((x, j) => j === i ? { ...x, years: e.target.value } : x))} />
          <button type="button" onClick={() => upd("history", pr.history.filter((_, j) => j !== i))} aria-label="Remove" style={{ ...btnOutline, padding: "6px 10px" }}>✕</button>
        </div>
      ))}
      {pr.history.length < 10 && <button type="button" onClick={() => upd("history", [...pr.history, { role: "", org: "", years: "" }])} style={{ ...btnOutline, marginBottom: 12 }}>+ Add a job</button>}
      <Field label="CV" optional error={err("cv")} hint={pr.cv ? `Saved: ${pr.cv.fileName}. Choose a file to replace it.` : "PDF or Word, max 5 MB. Without one, employers see your TIN Profile."}>
        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setCvFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
      </Field>
    </>;
  } else if (step === 2) {
    const types = workTypesForLane(pr.lane).map(o => ({ ...o, labelHi: bi ? WORK_TYPE_HI[o.key] : undefined }));
    pane = <>
      <Field label={t("workWanted", bi)} optional>
        <Pick multiple label="Kind of work" options={types} value={pr.workTypePrefs} onChange={v => upd("workTypePrefs", v)} accent={LANE_COLOR[pr.lane] || "var(--acc)"} />
      </Field>
      <Field label={t("expectedPay", bi)} optional><input className="fi" style={bi ? big : undefined} value={pr.expectedPay} onChange={e => upd("expectedPay", e.target.value)} placeholder={bi ? "e.g. ₹900 / day" : "e.g. ₹6 LPA"} /></Field>
      {!bi && <Field label="Current pay" optional hint="Never shown to employers."><input className="fi" value={pr.currentPay} onChange={e => upd("currentPay", e.target.value)} /></Field>}
    </>;
  } else {
    pane = <>
      <Field label={t("available", bi)} optional>
        <Pick label="Available" options={AVAIL.map(o => ({ ...o, labelHi: bi ? AVAIL_HI[o.key] : undefined }))} value={pr.availability} onChange={v => upd("availability", pr.availability === v ? "" : v)} />
      </Field>
      <Field label={t("whoCanSee", bi)}>
        <select className="fi" style={bi ? big : undefined} value={pr.visibility || DEFAULT_VISIBILITY} onChange={e => upd("visibility", e.target.value)}>
          {VISIBILITY.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 6, background: "var(--s2)", borderRadius: 8, padding: "8px 10px" }}>
          <b>{labelOf(VISIBILITY, pr.visibility || DEFAULT_VISIBILITY)}:</b> {VIS_NOTE[pr.visibility] || VIS_NOTE.default}
        </div>
      </Field>
    </>;
  }

  return shell(<>
    <h1 style={{ ...heading, fontSize: 26, margin: "0 0 2px" }}>My job profile {bi && <span lang="hi" style={{ fontSize: 18, color: "var(--t3)" }}>· मेरी प्रोफ़ाइल</span>}</h1>
    <p style={{ fontSize: 13, color: "var(--t3)", margin: "0 0 12px" }}>{bi ? "मुफ़्त। बाकी जानकारी बाद में जोड़ सकते हैं। · Free. You can add more later." : "Free. One profile for every job on TIN. Steps 3 and 4 are optional."}</p>
    <style>{`.pj-grid2{display:grid;grid-template-columns:1fr;gap:0 12px}@media (min-width:600px){.pj-grid2{grid-template-columns:1fr 1fr}}`}</style>
    <nav aria-label="Steps" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
      {STEPS.map(([en, hi], i) => (
        <button key={en} type="button" onClick={() => (i <= 1 || pr.exists || savedOnce || (validate(0) && validate(1))) && setStep(i)} aria-current={i === step ? "step" : undefined}
          style={{ whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
            border: `1px solid ${i === step ? "var(--acc)" : "var(--b2)"}`, background: i === step ? "var(--s2)" : "var(--s1)", color: "var(--t1)" }}>
          {i + 1}. {en}{bi ? <span lang="hi" style={{ fontWeight: 500, color: "var(--t3)" }}> · {hi}</span> : null}{i >= 2 ? <span style={{ fontWeight: 400, color: "var(--t3)" }}> · optional</span> : null}
        </button>
      ))}
    </nav>
    <div style={{ ...card, padding: 18 }}>
      {pane}
      {errors.save && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>⚠ {errors.save}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)} style={{ ...btnOutline, minHeight: 46 }}>← {t("back", bi)}</button> : <span />}
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {step >= 1 && <button type="button" disabled={saving} onClick={() => save()} style={{ ...btnOutline, minHeight: 46 }}>{saving ? "…" : bi ? "सेव करें, बाद में पूरा करें · Save & finish later" : "Save & finish later"}</button>}
          {step >= 2 && step < 3 && <button type="button" onClick={() => setStep(3)} style={{ ...btnOutline, minHeight: 46 }}>{t("skip", bi)}</button>}
          {step < 3
            ? <button type="button" onClick={goNext} style={{ ...btnPrimary, minHeight: 46, fontSize: 14 }}>{t("next", bi)} →</button>
            : <button type="button" disabled={saving} onClick={() => save({ finish: true })} style={{ ...btnPrimary, minHeight: 46, fontSize: 14 }}>{saving ? "…" : bi ? "प्रोफ़ाइल सेव करें · Save profile" : "Save profile"}</button>}
        </span>
      </div>
      {savedOnce && <div style={{ fontSize: 12, color: "#15803d", marginTop: 8 }}>✓ {bi ? "सेव हो गया · Saved" : "Saved"} — <Link to="/jobs" style={{ color: "var(--acc)" }}>{bi ? "नौकरियाँ देखें · Browse jobs" : "Browse jobs"}</Link></div>}
    </div>
  </>);
}
