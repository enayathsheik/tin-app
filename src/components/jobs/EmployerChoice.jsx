// A1: the one clear question — may employers find and call this person from
// search? Nobody is on employer search until they say yes. Keep the wording in
// sync with the Privacy page. Skilled lane: Hindi too.
import { useState } from "react";
import { saveEmployerChoice } from "../../lib/jobProfiles";
import { LOOKING } from "../../utils/candidateSearch.js";
import { VISIBILITY, labelOf } from "../../data/jobsTaxonomy.js";

const TEXT = {
  title: ["Let employers find and call me", "नौकरी देने वाले मुझे ढूँढकर कॉल कर सकें"],
  body: [
    "Employers on TIN can find your profile. If one shortlists you for their job, they get your phone number, email and CV straight away, without asking you again. You can turn this off any time.",
    "TIN पर नौकरी देने वाले आपकी प्रोफ़ाइल ढूँढ सकेंगे। कोई अपनी नौकरी के लिए आपको शॉर्टलिस्ट करे, तो उसे आपका फ़ोन नंबर, ईमेल और CV तुरंत मिल जाएगा, दोबारा पूछे बिना। आप इसे कभी भी बंद कर सकते हैं।",
  ],
  yes: ["Yes, employers can find me", "हाँ, मुझे ढूँढ सकते हैं"],
  no: ["No, only when I apply", "नहीं, सिर्फ़ जब मैं आवेदन करूँ"],
};
const two = (k, bi) => <>{TEXT[k][0]}{bi && <span lang="hi" style={{ display: "block", fontWeight: "inherit" }}>{TEXT[k][1]}</span>}</>;

// value: true | false | null (not answered yet).
export function EmployerChoice({ value, onChange, bi = false, visibility, busy = false, error, style }) {
  const opt = (v, k) => {
    const on = value === v;
    return (
      <button type="button" aria-pressed={on} disabled={busy} onClick={() => onChange(v)}
        style={{ flex: "1 1 200px", minHeight: 52, padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: bi ? 16 : 14, fontWeight: 700, textAlign: "left", color: "var(--t1)",
          border: `2px solid ${on ? "var(--acc)" : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)" }}>
        {on ? "✓ " : ""}{two(k, bi)}
      </button>
    );
  };
  const hidden = value === true && visibility && !LOOKING.includes(visibility);
  return (
    <div role="group" aria-label={TEXT.title[0]} style={{ border: `1px solid ${error ? "#dc2626" : "#bfdbfe"}`, background: "#eff6ff", borderRadius: 12, padding: 14, ...style }}>
      <div style={{ fontSize: bi ? 18 : 16, fontWeight: 800, color: "var(--t1)" }}>📞 {two("title", bi)}</div>
      <div style={{ fontSize: bi ? 14 : 13, color: "var(--t2)", margin: "4px 0 10px", lineHeight: 1.5 }}>{two("body", bi)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{opt(true, "yes")}{opt(false, "no")}</div>
      {hidden && <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>Your profile is set to “{labelOf(VISIBILITY, visibility)}”, so employers won’t find you until you change that.
        {bi && <span lang="hi" style={{ display: "block" }}>आपकी प्रोफ़ाइल अभी छिपी है। इसे बदलने तक नौकरी देने वाले आपको नहीं ढूँढ पाएँगे।</span>}</div>}
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 8 }}>⚠ {error}</div>}
    </div>
  );
}

// The same question for a profile that already exists: saves on tap.
export function SavedEmployerChoice({ uid, profile, onSaved, bi = false, style }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const answered = typeof profile.openToEmployers === "boolean";
  const choose = async (v) => {
    setBusy(true); setError("");
    try {
      await saveEmployerChoice(uid, v, profile);
      onSaved(v);
      setOpen(false);
    } catch (e) {
      console.error("[job-profile] employer choice not saved:", e);
      setError(bi ? "सेव नहीं हुआ, फिर कोशिश करें। · Couldn't save. Please try again." : "Couldn't save. Please try again.");
    }
    setBusy(false);
  };
  if (answered && !open) {
    const on = profile.openToEmployers;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: "var(--t2)", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", ...style }}>
        <span>📞 {two("title", bi)} <b>→ {on ? (bi ? "हाँ · Yes" : "Yes") : (bi ? "नहीं · No" : "No")}</b>
          {on && !LOOKING.includes(profile.visibility) && <span style={{ color: "#b45309" }}> (hidden: “{labelOf(VISIBILITY, profile.visibility)}”)</span>}
        </span>
        <button type="button" className="btn-sm btn-out" style={{ minHeight: 40 }} onClick={() => setOpen(true)}>{bi ? "बदलें · Change" : "Change"}</button>
      </div>
    );
  }
  return <EmployerChoice value={profile.openToEmployers} visibility={profile.visibility} onChange={choose} bi={bi} busy={busy} error={error} style={style} />;
}
