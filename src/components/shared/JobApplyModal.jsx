import { useState } from "react";
import { Link } from "react-router-dom";
import { normaliseJob } from "../../utils/jobModel.js";
import { isApplyReady, missingForApply } from "../../utils/jobProfile.js";
import { TRADES, labelOf } from "../../data/jobsTaxonomy.js";
import { t } from "../../data/jobsHindi.js";
import { saveJobProfile, validateCvFile } from "../../lib/jobProfiles";
import { submitApplication } from "../../lib/applications";
import { TradeTiles } from "../jobs/TradeTiles";

const label = { fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 };
const bigInput = { fontSize: 16, padding: "12px 14px", minHeight: 48 };

// Apply sheet (Phase 4). One tap when the candidate's profile has the
// basics (name, mobile, trade/role, city); otherwise a short form asking
// only for those, which also fills the profile. CV optional — with no CV
// the employer sees the candidate's "TIN Profile" card. Skilled-lane jobs
// are bilingual with big tap targets.
export function JobApplyModal({ user, applyingJob, profile, setProfile, closeApply, markApplied }) {
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [cvChoice, setCvChoice] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!applyingJob) return null;
  const job = normaliseJob(applyingJob);
  const lane = job.lane;
  const bi = lane === "skilled";
  const loading = !profile;
  const ready = profile && !profile.error && isApplyReady(profile, lane);
  const f = form || (profile && !profile.error ? {
    name: profile.name, phone: profile.phone, city: profile.city, role: profile.role,
    trades: job.trade && !(profile.trades || []).length ? [job.trade] : (profile.trades || []),
  } : null);
  const choice = cvChoice || (profile?.cv ? "profile" : "none");

  const close = () => { setForm(null); setMessage(""); setCvChoice(null); setFile(null); setError(""); setSent(false); closeApply(); };
  const upd = (k, v) => setForm({ ...f, [k]: v });

  const send = async () => {
    setError("");
    let pr = profile;
    if (!ready) {
      const merged = {
        ...profile,
        name: f.name, phone: f.phone, city: f.city,
        lane: profile.lane || lane,
        ...(lane === "skilled" ? { trades: [...new Set([...(profile.trades || []), ...(f.trades || [])])] } : { role: f.role }),
      };
      const miss = missingForApply(merged, lane);
      if (miss.length) {
        setError(bi ? "नाम, 10 अंकों का मोबाइल नंबर, काम और शहर भरें। · Please add your name, 10-digit mobile, trade and city." : "Please add your name, a 10-digit mobile number, your role and city.");
        return;
      }
      pr = merged;
    }
    if (choice === "upload") {
      const err = validateCvFile(file);
      if (err) { setError(err); return; }
    }
    setSending(true);
    try {
      if (!ready) {
        await saveJobProfile(user.uid, pr, { isNew: !profile.exists });
        setProfile({ ...pr, exists: true });
      }
      await submitApplication(user, applyingJob, pr, { message, cvChoice: choice, file });
      markApplied(applyingJob.id);
      setSent(true);
    } catch (e) {
      console.error("[apply] failed:", e);
      setError((bi ? "आवेदन नहीं भेजा जा सका। · " : "") + "Could not send the application: " + (e.message || e));
    }
    setSending(false);
  };

  const sheet = (children) => (
    <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
      <div role="dialog" aria-label="Apply" style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: 20, maxWidth: 520, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 -8px 32px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  const head = (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22, color: "#080808" }}>
        {bi ? "आवेदन करें · Apply" : "Apply"} — {job.title}
      </div>
      <div style={{ fontSize: 13, color: "#666" }}>{job.businessName || job.postedByName}{job.city ? ` · ${job.city}` : ""}</div>
    </div>
  );

  if (sent) {
    return sheet(<div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#080808" }}>{bi ? "आवेदन भेज दिया · Application sent" : "Application sent"}</div>
      <div style={{ fontSize: 13, color: "#555", margin: "6px 0 16px" }}>
        {bi ? "हर अपडेट 'मेरे आवेदन' में दिखेगा। · Every update shows in My applications." : "Every update from the employer shows in My applications."}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/jobs/applications" onClick={close} style={{ padding: "12px 18px", borderRadius: 10, background: "#e85a2a", color: "#fff", fontWeight: 700, textDecoration: "none" }}>{t("myApplications", bi)}</Link>
        <button onClick={close} style={{ padding: "12px 18px", borderRadius: 10, background: "#f5f5f5", border: "1px solid #e0e0e0", fontWeight: 700, cursor: "pointer" }}>{bi ? "ठीक है · Done" : "Done"}</button>
      </div>
      {!profile?.experienceYears && (
        <Link to="/jobs/profile" onClick={close} style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: "#e85a2a", fontWeight: 700 }}>
          {bi ? "प्रोफ़ाइल पूरी करें (बाद में भी कर सकते हैं) · Complete your profile" : "Add more to your profile (optional) →"}
        </Link>
      )}
    </div>);
  }

  if (loading) return sheet(<>{head}<div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading…</div></>);
  if (profile.error) return sheet(<>{head}<div role="alert" style={{ padding: 16, color: "#b91c1c" }}>Couldn't load your profile. Please check your connection and try again.</div>
    <button onClick={close} style={{ minHeight: 48, padding: "0 16px", borderRadius: 12, background: "#f5f5f5", border: "1px solid #e0e0e0", fontWeight: 700, cursor: "pointer" }}>Close</button></>);

  const cvBlock = (
    <div style={{ marginTop: 12 }}>
      <div style={label}>{bi ? "CV (ज़रूरी नहीं) · CV (optional)" : "CV (optional)"}</div>
      {[
        ...(profile?.cv ? [["profile", `My saved CV — ${profile.cv.fileName}`]] : []),
        ["upload", bi ? "इस नौकरी के लिए CV अपलोड करें · Upload a CV for this job" : "Upload a CV for this job"],
        ["none", bi ? "मेरी TIN प्रोफ़ाइल भेजें · Send my TIN Profile" : "Send my TIN Profile (built from your profile)"],
      ].map(([k, l]) => (
        <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#222", padding: "8px 0", cursor: "pointer" }}>
          <input type="radio" name="cv-choice" checked={choice === k} onChange={() => setCvChoice(k)} style={{ width: 18, height: 18 }} /> {l}
        </label>
      ))}
      {choice === "upload" && (
        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13, width: "100%", marginTop: 4 }} />
      )}
    </div>
  );

  return sheet(<>
    {head}
    {ready ? (
      <div style={{ background: "#f7f7f9", borderRadius: 12, padding: 12, fontSize: 14, color: "#222" }}>
        <div style={{ fontWeight: 700 }}>{profile.name}</div>
        <div style={{ color: "#555" }}>
          {lane === "skilled" ? profile.trades.map(k => TRADES.find(x => x.key === k)?.labelHi).filter(Boolean).join(", ") : profile.role}
          {" · "}{profile.city}{profile.experienceYears ? ` · ${profile.experienceYears} yrs` : ""}
        </div>
        <Link to="/jobs/profile" onClick={close} style={{ fontSize: 12, color: "#e85a2a", fontWeight: 700 }}>{bi ? "प्रोफ़ाइल बदलें · Edit profile" : "Edit profile"}</Link>
      </div>
    ) : (
      <>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>{bi ? "बस 4 चीज़ें · Just 4 things" : "Just the basics — you can add more later."}</div>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={label}>{t("yourName", bi)}</div>
          <input className="fi" style={bigInput} value={f.name} onChange={e => upd("name", e.target.value)} autoComplete="name" />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={label}>{t("mobile", bi)}</div>
          <input className="fi" style={bigInput} inputMode="tel" value={f.phone} onChange={e => upd("phone", e.target.value)} placeholder="98xxxxxx10" />
          <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>{t("phonePrivate", bi)}</div>
        </label>
        {lane === "skilled" ? (
          <div style={{ marginBottom: 10 }}>
            <div style={label}>{t("yourTrade", bi)}</div>
            <TradeTiles value={f.trades} onChange={v => upd("trades", v)} />
          </div>
        ) : (
          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={label}>Your current role</div>
            <input className="fi" style={bigInput} value={f.role} onChange={e => upd("role", e.target.value)} placeholder="e.g. Sales Executive" />
          </label>
        )}
        <label style={{ display: "block", marginBottom: 4 }}>
          <div style={label}>{t("city", bi)}</div>
          <input className="fi" style={bigInput} value={f.city} onChange={e => upd("city", e.target.value)} placeholder="e.g. Thane" />
        </label>
      </>
    )}
    <label style={{ display: "block", marginTop: 12 }}>
      <div style={label}>{bi ? "संदेश (ज़रूरी नहीं) · Message (optional)" : "Message (optional)"}</div>
      <textarea className="fta" rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder={bi ? "जैसे: कल से आ सकता हूँ" : "A short note for the employer"} />
    </label>
    {cvBlock}
    {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>⚠ {error}</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <button onClick={send} disabled={sending}
        style={{ flex: 1, minHeight: 52, borderRadius: 12, background: sending ? "#f5f5f5" : "#e85a2a", border: "none", color: sending ? "#888" : "#fff", fontSize: 16, fontWeight: 800, cursor: sending ? "default" : "pointer" }}>
        {sending ? "…" : t("sendApplication", bi)}
      </button>
      <button onClick={close} style={{ minHeight: 52, padding: "0 16px", borderRadius: 12, background: "#f5f5f5", border: "1px solid #e0e0e0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        {bi ? "रद्द · Cancel" : "Cancel"}
      </button>
    </div>
    {lane === "skilled" && job.trade && <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>{labelOf(TRADES, job.trade)} · {TRADES.find(x => x.key === job.trade)?.labelHi}</div>}
  </>);
}
