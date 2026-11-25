// Skilled workers: sign up (/signup/skilled) and log in on a new phone
// (/login/otp) with a one-time code. One question per screen, big buttons,
// Hindi first. Screens use src/lib/otp only, so the SMS provider can change.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CITIES } from "../data/constants";
import { sendOtp } from "../lib/otp";
import { afterOtp, confirmedPhone, createSkilledAccount, dropPhoneSignIn, joinOldAccount } from "../lib/skilledAccount";
import { CODE_LENGTH, RESEND_SECONDS, cleanCode, missingFor, otpText } from "../utils/otp.js";
import { normalizeIndianMobile } from "../utils/phoneAuth.js";
import { signupNext } from "../utils/signup.js";
import { EmployerChoice } from "../components/jobs/EmployerChoice";
import { TradeTiles } from "../components/jobs/TradeTiles";
import { JobsStyles } from "../components/jobs/jobsUi";
import { btnPrimary, card, heading } from "../components/jobs/jobsStyle";

const input = { fontSize: 22, padding: "14px 16px", minHeight: 60, width: "100%", boxSizing: "border-box" };
const bigBtn = { ...btnPrimary, width: "100%", minHeight: 60, fontSize: 19, borderRadius: 14, marginTop: 14 };
const link = { background: "none", border: "none", padding: "10px 0", color: "var(--acc)", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", textAlign: "left" };
const QUESTIONS = ["name", "trade", "city", "choice"];
const MISSING = {
  name: ["Write your name.", "अपना नाम लिखें।"],
  trade: ["Tap your trade.", "अपना काम चुनें।"],
  city: ["Write your city.", "अपना शहर लिखें।"],
  choice: ["Choose yes or no.", "हाँ या नहीं चुनें।"],
  wrong_password: ["Wrong password. Try again.", "पासवर्ड गलत है। फिर कोशिश करें।"],
};

function Title({ hi, en }) {
  return <h1 style={{ ...heading, margin: "0 0 14px" }}><span lang="hi" style={{ fontSize: 28, display: "block", lineHeight: 1.25 }}>{hi}</span><span style={{ fontSize: 18, color: "var(--t3)" }}>{en}</span></h1>;
}
const Two = ({ hi, en }) => <><span lang="hi">{hi}</span> · {en}</>;

export function SkilledOtpPage({ login = false, user, pendingPath, onSignedUp, onLogin }) {
  const [wasIn] = useState(() => !!user);
  const [step, setStep] = useState("phone"); // phone · code · join · password · name · trade · city · choice
  const [mobile, setMobile] = useState("");
  const [session, setSession] = useState(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [pass, setPass] = useState("");
  const [f, setF] = useState({ name: "", trades: [], city: "", openToEmployers: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // [English, Hindi]

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const landed = (profile) => onSignedUp(profile, signupNext("jobseeker", pendingPath, "/jobs/skilled"));
  const run = async (fn, textFor = otpText) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) {
      if (!e?.code) console.error("[skilled] failed:", e);
      setError(textFor(e?.code));
    }
    setBusy(false);
  };
  const goOn = async () => {
    const r = await afterOtp();
    if (r.next === "in") landed(r.profile);
    else setStep(r.next === "join" ? "join" : r.next === "password" ? "password" : "name");
  };

  // Came back after a reload with the number already confirmed on this phone.
  useEffect(() => {
    if (wasIn || !confirmedPhone()) return;
    let cancelled = false;
    afterOtp().then(r => {
      if (cancelled) return;
      if (r.next === "in") landed(r.profile);
      else setStep(r.next === "join" ? "join" : r.next === "password" ? "password" : "name");
    }).catch(e => console.warn("[skilled] resume failed:", e?.code || e));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on opening the page
  }, []);

  if (wasIn) return <Navigate to="/jobs" replace />;

  const send = () => {
    const phone = normalizeIndianMobile(mobile);
    if (!phone) { setError(otpText("bad_phone")); return; }
    run(async () => {
      const s = await sendOtp(phone);
      setSession(s); setCode(""); setWait(RESEND_SECONDS); setStep("code");
    });
  };
  const confirm = (value) => {
    if (value.length < CODE_LENGTH) { setError(otpText("bad_code")); return; }
    run(async () => {
      // A retry after the code was accepted but the next step failed.
      if (!confirmedPhone()) {
        try { await session.confirm(value); } catch (e) { if (e?.code !== "network") setCode(""); throw e; }
      }
      try { await goOn(); } catch (e) { throw Object.assign(new Error("next"), { code: "failed", cause: e }); }
    });
  };
  const join = () => run(async () => {
    const profile = await joinOldAccount(pass.trim());
    if (profile) landed(profile); else setStep("name");
  }, (c) => MISSING[c] || otpText(c));
  const next = () => {
    const miss = missingFor(step, f);
    if (miss) { setError(MISSING[miss]); return; }
    setError(null);
    const i = QUESTIONS.indexOf(step);
    if (i < QUESTIONS.length - 1) { setStep(QUESTIONS[i + 1]); window.scrollTo?.(0, 0); return; }
    run(async () => landed(await createSkilledAccount(f)), () => otpText("failed"));
  };
  const back = () => { setError(null); const i = QUESTIONS.indexOf(step); if (i > 0) setStep(QUESTIONS[i - 1]); };
  const startOver = () => run(async () => { await dropPhoneSignIn(); setSession(null); setCode(""); setPass(""); setStep("phone"); });
  const usePassword = () => run(async () => { await dropPhoneSignIn(); onLogin(); });
  const submit = (fn) => (e) => { e.preventDefault(); if (!busy) fn(); };
  const shownPhone = normalizeIndianMobile(mobile) || confirmedPhone() || "";

  let body;
  if (step === "phone") {
    body = <form onSubmit={submit(send)} noValidate>
      <Title hi={login ? "मोबाइल नंबर से लॉगिन करें" : "अपना मोबाइल नंबर लिखें"} en={login ? "Log in with your mobile number" : "Your mobile number"} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--t2)" }}>+91</span>
        <input className="fi" style={input} type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="Mobile number" value={mobile} onChange={e => { setMobile(e.target.value.replace(/[^\d+ ]/g, "")); setError(null); }} placeholder="98765 43210" />
      </div>
      <p style={{ fontSize: 14, color: "var(--t3)", margin: "8px 0 0" }}><Two hi="SMS पर 6 अंकों का कोड आएगा" en="We’ll send a 6-digit code by SMS" /></p>
      <button type="submit" disabled={busy} style={bigBtn}>{busy ? "…" : <Two hi="कोड भेजें" en="Send code" />}</button>
      <button type="button" onClick={onLogin} style={{ ...link, fontSize: 14 }}><Two hi="पासवर्ड से लॉगिन" en="Log in with a password" /></button>
    </form>;
  } else if (step === "code") {
    body = <form onSubmit={submit(() => confirm(code))} noValidate>
      <Title hi="SMS में आया कोड लिखें" en={`Code sent to +91 ${shownPhone}`} />
      <input className="fi" style={{ ...input, letterSpacing: 10, textAlign: "center", fontSize: 28 }} inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code" autoFocus maxLength={CODE_LENGTH + 4} value={code}
        onChange={e => { const c = cleanCode(e.target.value); setCode(c); setError(null); if (c.length === CODE_LENGTH && !busy) confirm(c); }} />
      <button type="submit" disabled={busy} style={bigBtn}>{busy ? "…" : <Two hi="आगे" en="Continue" />}</button>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <button type="button" disabled={wait > 0 || busy} onClick={send} style={{ ...link, color: wait > 0 ? "var(--t3)" : "var(--acc)" }}><Two hi="कोड दोबारा भेजें" en={wait > 0 ? `Resend in ${wait}s` : "Resend code"} /></button>
        <button type="button" disabled={busy} onClick={() => { setStep("phone"); setError(null); }} style={link}><Two hi="नंबर बदलें" en="Change number" /></button>
      </div>
    </form>;
  } else if (step === "join") {
    body = <form onSubmit={submit(join)} noValidate>
      <Title hi="इस नंबर से पहले से एक खाता है" en="This number already has a TIN account" />
      <p style={{ fontSize: 15, color: "var(--t2)", margin: "0 0 12px" }}><span lang="hi">पुराना पासवर्ड एक बार लिखें। फिर आगे से सिर्फ़ कोड से लॉगिन होगा।</span><br />Enter its password once. After that you log in with a code.</p>
      <input className="fi" style={input} type="password" autoComplete="current-password" aria-label="Old password" value={pass} onChange={e => { setPass(e.target.value); setError(null); }} placeholder="पासवर्ड · Password" />
      <button type="submit" disabled={busy || !pass.trim()} style={{ ...bigBtn, opacity: pass.trim() ? 1 : 0.5 }}>{busy ? "…" : <Two hi="खाता जोड़ें" en="Join my account" />}</button>
      <button type="button" disabled={busy} onClick={() => { setError(null); setStep("name"); }} style={link}><Two hi="यह मेरा खाता नहीं है, या पासवर्ड याद नहीं" en="Not mine, or I forgot: make a new account" /></button>
    </form>;
  } else if (step === "password") {
    body = <div>
      <Title hi="इस नंबर का खाता पासवर्ड से खुलता है" en="This number’s account uses a password" />
      <p style={{ fontSize: 15, color: "var(--t2)", margin: 0 }}><span lang="hi">कृपया पासवर्ड से लॉगिन करें।</span><br />Please log in with your password.</p>
      <button type="button" disabled={busy} onClick={usePassword} style={bigBtn}>{busy ? "…" : <Two hi="पासवर्ड से लॉगिन" en="Log in with password" />}</button>
      <button type="button" disabled={busy} onClick={() => { setError(null); setStep("name"); }} style={link}><Two hi="यह मेरा खाता नहीं है" en="That’s not mine: make a new skilled-worker account" /></button>
    </div>;
  } else {
    const i = QUESTIONS.indexOf(step);
    body = <form onSubmit={submit(next)} noValidate>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", marginBottom: 6 }}>{i + 1} / {QUESTIONS.length}</div>
      {step === "name" && <><Title hi="आपका नाम" en="Your name" /><input className="fi" style={input} autoComplete="name" aria-label="Your name" value={f.name} onChange={e => { setF({ ...f, name: e.target.value }); setError(null); }} /></>}
      {step === "trade" && <><Title hi="आप क्या काम करते हैं?" en="Your trade (tap one or more)" /><TradeTiles value={f.trades} onChange={v => { setF({ ...f, trades: v }); setError(null); }} /></>}
      {step === "city" && <><Title hi="आपका शहर" en="Your city" /><input className="fi" style={input} list="sk-cities" aria-label="Your city" value={f.city} onChange={e => { setF({ ...f, city: e.target.value }); setError(null); }} placeholder="Thane" /><datalist id="sk-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist></>}
      {step === "choice" && <><Title hi="आखिरी सवाल" en="Last question" /><EmployerChoice bi value={f.openToEmployers} onChange={v => { setF({ ...f, openToEmployers: v }); setError(null); }} /></>}
      <button type="submit" disabled={busy} style={bigBtn}>{busy ? "…" : step === "choice" ? <Two hi="खाता बनाएँ" en="Create account" /> : <Two hi="आगे" en="Next" />}</button>
      {i > 0 ? <button type="button" disabled={busy} onClick={back} style={link}>← <Two hi="पीछे" en="Back" /></button>
        : <button type="button" disabled={busy} onClick={startOver} style={link}><Two hi="दूसरे नंबर से शुरू करें" en="Use another number" /></button>}
    </form>;
  }

  return (
    <div className="tj-scroll"><div className="tj-wrap" style={{ maxWidth: 520 }}>
      <JobsStyles />
      <Helmet><title>{login ? "Log in with a code" : "Skilled worker sign-up"} | TIN Jobs</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{ ...card, padding: 20, borderTop: "4px solid var(--warn)" }}>
        {body}
        {error && <div role="alert" style={{ fontSize: 15, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>⚠ <span lang="hi">{error[1]}</span><br />{error[0]}</div>}
      </div>
    </div></div>
  );
}
