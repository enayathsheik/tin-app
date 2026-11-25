// Sign-up (B1): /signup (choose), /signup/work (job seeker), /signup/hire
// (employer). Login stays one page (LoginPage).
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CITIES } from "../data/constants";
import { INDUSTRIES } from "../data/jobsTaxonomy.js";
import { FEATURES } from "../data/features";
import { PRODUCT_CATEGORIES, createAccount } from "../lib/signup";
import { emptySignup, signupError, signupLanding, signupNext, validateSignup } from "../utils/signup.js";
import { btnOutline, btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { JobsStyles } from "../components/jobs/jobsUi";
import { Field, Pick } from "../components/jobs/WizardFields";
import { Sheet } from "../components/jobs/desk/Sheet";

const big = { fontSize: 16, padding: "12px 14px", minHeight: 48 };
const KINDS = {
  work: { title: "I'm looking for work", hi: "मुझे काम चाहिए", icon: "👷", text: "Make a free job profile, apply to jobs, and let employers find you." },
  hire: { title: "I'm hiring", hi: "मुझे लोग चाहिए", icon: "🏢", text: "Post jobs, find candidates and manage applicants for your business." },
};

function Shell({ title, onLogin, children }) {
  return (
    <div className="tj-scroll"><div className="tj-wrap" style={{ maxWidth: 560 }}>
      <JobsStyles />
      <Helmet><title>{`${title} | TIN Jobs`}</title><meta name="robots" content="noindex" /></Helmet>
      {children}
      <div style={{ textAlign: "center", fontSize: 14, color: "var(--t2)", marginTop: 16 }}>
        Already have an account? <button type="button" onClick={onLogin} style={{ background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Log in · लॉग इन</button>
      </div>
    </div></div>
  );
}

// `kind` = "work" | "hire" | undefined (choose). `pendingPath` = where they
// were going when asked to log in (e.g. a job they wanted to apply to).
export function SignupPage({ kind, user, pendingPath, onSignedUp, onLogin }) {
  // Someone already logged in has nothing to do here. Checked once: this page
  // also sees `user` appear while it is creating the account.
  const [wasIn] = useState(() => !!user);
  if (wasIn) return <Navigate to={signupLanding(user?.role)} replace />;
  if (!kind) {
    return (
      <Shell title="Create your account" onLogin={onLogin}>
        <h1 style={{ ...heading, fontSize: 28, margin: "8px 0 4px" }}>Create your free account</h1>
        <p style={{ fontSize: 14, color: "var(--t3)", margin: "0 0 14px" }}>What brings you to TIN Jobs?</p>
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(KINDS).map(([k, o]) => (
            <Link key={k} to={`/signup/${k}`} style={{ ...card, padding: 18, textDecoration: "none", display: "flex", gap: 14, alignItems: "center", borderLeft: "4px solid var(--acc)" }}>
              <span aria-hidden="true" style={{ fontSize: 34 }}>{o.icon}</span>
              <span>
                <span style={{ ...heading, fontSize: 22, display: "block" }}>{o.title} <span lang="hi" style={{ fontSize: 16, color: "var(--t3)" }}>· {o.hi}</span></span>
                <span style={{ fontSize: 13, color: "var(--t3)" }}>{o.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Shell>
    );
  }
  return <SignupForm key={kind} kind={kind} pendingPath={pendingPath} onSignedUp={onSignedUp} onLogin={onLogin} />;
}

function SignupForm({ kind, pendingPath, onSignedUp, onLogin }) {
  const navigate = useNavigate();
  // "Switch to job seeker account" keeps what was typed (never the password).
  const { state } = useLocation();
  const [f, setF] = useState(() => {
    const start = emptySignup(kind), from = state?.signup || {};
    for (const k of ["name", "method", "mobile", "email"]) if (typeof from[k] === "string" && from[k]) start[k] = from[k];
    return start;
  });
  const [errors, setErrors] = useState({});
  const [fail, setFail] = useState(null); // { text, exists }
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const hire = kind === "hire";
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setFail(null); };

  const create = async () => {
    setConfirm(false); setBusy(true); setFail(null);
    try {
      const u = await createAccount(kind, f);
      onSignedUp(u, signupNext(u.role, state?.back || pendingPath));
    } catch (e) {
      console.error("[signup] failed:", e?.code || e);
      setFail(signupError(e?.code, f.method));
      setBusy(false);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    const found = validateSignup(kind, f);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (hire) setConfirm(true); else create();
  };
  const switchToSeeker = () => {
    setConfirm(false);
    navigate("/signup/work", { state: { signup: { name: f.name, method: f.method, mobile: f.mobile, email: f.email } } });
  };

  const o = KINDS[kind];
  return (
    <Shell title={o.title} onLogin={onLogin}>
      <Link to="/signup" style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>← Back</Link>
      <h1 style={{ ...heading, fontSize: 28, margin: "6px 0 2px" }}>{o.icon} {o.title} <span lang="hi" style={{ fontSize: 18, color: "var(--t3)" }}>· {o.hi}</span></h1>
      <p style={{ fontSize: 14, color: "var(--t3)", margin: "0 0 12px" }}>{hire ? "Free during launch. Any email or mobile number works." : "Free. You’ll make your job profile next."}</p>
      {!hire && FEATURES.skilledOtp && <>
        <Link to="/signup/skilled" style={{ ...card, padding: 18, textDecoration: "none", display: "flex", gap: 14, alignItems: "center", border: "2px solid var(--warn)", marginBottom: 14 }}>
          <span aria-hidden="true" style={{ fontSize: 34 }}>🧱</span>
          <span>
            <span lang="hi" style={{ ...heading, fontSize: 24, display: "block" }}>कारीगर / मिस्त्री हैं?</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--t2)", display: "block" }}>Skilled trade: mason, electrician, carpenter…</span>
            <span style={{ fontSize: 14, color: "var(--t3)" }}><span lang="hi">सिर्फ़ मोबाइल नंबर से, पासवर्ड नहीं</span> · Just your phone, no password →</span>
          </span>
        </Link>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", margin: "0 0 8px" }}>Professional (office, sales, design, engineering…)</div>
      </>}
      <form onSubmit={submit} noValidate style={{ ...card, padding: 18 }}>
        {hire && <>
          <Field label="Business name" required error={errors.businessName}><input className="fi" style={big} value={f.businessName} onChange={e => set("businessName", e.target.value)} autoComplete="organization" /></Field>
          <Field label="Type of business" required error={errors.industry}>
            <select className="fi" style={big} value={f.industry} onChange={e => set("industry", e.target.value)}>
              <option value="">Choose one</option>{INDUSTRIES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="City" required error={errors.city}><input className="fi" style={big} list="su-cities" value={f.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Thane" /></Field>
          <datalist id="su-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Products you deal in <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(tick all that apply, optional)</span></div>
          <div style={{ marginBottom: 14 }}>
            <Pick multiple label="Products you deal in" options={PRODUCT_CATEGORIES.map(c => ({ key: c, label: c }))} value={f.dealsIn} onChange={v => set("dealsIn", v)} />
          </div>
        </>}
        <Field label={hire ? "Your name" : "Your name · आपका नाम"} required error={errors.name}><input className="fi" style={big} value={f.name} onChange={e => set("name", e.target.value)} autoComplete="name" /></Field>
        <div role="group" aria-label="Sign up with" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["mobile", hire ? "Mobile number" : "Mobile · मोबाइल"], ["email", hire ? "Email" : "Email · ईमेल"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f.method === k} onClick={() => set("method", k)}
              style={{ flex: 1, minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: "var(--t1)", border: `2px solid ${f.method === k ? "var(--acc)" : "var(--b2)"}`, background: f.method === k ? "var(--s2)" : "var(--s1)" }}>{f.method === k ? "✓ " : ""}{l}</button>
          ))}
        </div>
        {f.method === "email"
          ? <Field label="Email" required error={errors.email} hint="Any email works."><input className="fi" style={big} type="email" value={f.email} onChange={e => set("email", e.target.value)} autoComplete="email" /></Field>
          : <Field label="Mobile number" required error={errors.mobile} hint="You log in with this number and your password."><input className="fi" style={big} type="tel" inputMode="tel" value={f.mobile} onChange={e => set("mobile", e.target.value.replace(/[^\d+ ]/g, ""))} placeholder="98765 43210" autoComplete="tel" /></Field>}
        <Field label={hire ? "Password" : "Password · पासवर्ड"} required error={errors.password} hint="At least 6 characters."><input className="fi" style={big} type="password" value={f.password} onChange={e => set("password", e.target.value)} autoComplete="new-password" /></Field>
        {fail && (
          <div role="alert" style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            ⚠ {fail.text}{fail.exists && <> <button type="button" onClick={onLogin} style={{ background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Log in →</button></>}
          </div>
        )}
        <button type="submit" disabled={busy} style={{ ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, borderRadius: 12 }}>{busy ? "Creating…" : hire ? "Create business account" : "Create account · खाता बनाएँ"}</button>
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 10, textAlign: "center" }}>See how TIN handles your details: <Link to="/privacy" target="_blank" style={{ color: "var(--acc)" }}>Privacy</Link></div>
      </form>
      {confirm && (
        <Sheet title="Is this a business account?" onClose={() => setConfirm(false)}>
          <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.5, margin: "0 0 14px" }}>Business accounts are for people who hire. If you’re looking for work, use a job seeker account.</p>
          <div style={{ display: "grid", gap: 8 }}>
            <button type="button" onClick={create} style={{ ...btnPrimary, minHeight: 50, fontSize: 15 }}>Yes, I’m a business</button>
            <button type="button" onClick={switchToSeeker} style={{ ...btnOutline, minHeight: 50, fontSize: 15 }}>Switch to job seeker account</button>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}
