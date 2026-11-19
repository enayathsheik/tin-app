import { useState } from "react";
import { suggestJobProfile } from "../../lib/jobProfileAi";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { LANE_COLOR, btnOutline, btnPrimary } from "./jobsStyle";

// "Fill it for me" (docs/JOBS_BLUEPRINT.md §8): five short questions, one at
// a time, typed or spoken. The answers go to the suggestJobProfile function,
// which returns a draft; onDraft() puts it into the wizard for review.
// Skilled lane: Hindi first, big buttons. Professional lane: English first.
const MAX = 500;
const QUESTIONS = [
  { en: "What work do you do?", hi: "आप कौन सा काम करते हैं?",
    ex: { skilled: ["e.g. Mason, tile work", "जैसे: राजमिस्त्री, टाइल का काम"], professional: ["e.g. Sales executive for tiles and sanitaryware", "जैसे: टाइल्स की सेल्स"] } },
  { en: "How many years have you done this work?", hi: "कितने साल से यह काम कर रहे हैं?",
    ex: { skilled: ["e.g. 5 years", "जैसे: 5 साल"], professional: ["e.g. 6 years", "जैसे: 6 साल"] } },
  { en: "What kind of work have you done? (sites, buildings, shops…)", hi: "आपने कहाँ-कहाँ, कैसा काम किया है?",
    ex: { skilled: ["e.g. Plaster and blockwork on 3 towers in Thane", "जैसे: ठाणे में 3 बिल्डिंग में प्लास्टर का काम"], professional: ["e.g. Dealer and project sales at a tile brand, 2019–2024", "जैसे: टाइल कंपनी में डीलर सेल्स"] } },
  { en: "Which areas can you work in, and which languages do you speak?", hi: "किन इलाकों में काम करेंगे, कौन सी भाषा बोलते हैं?",
    ex: { skilled: ["e.g. Thane, Navi Mumbai · Hindi, Marathi", "जैसे: ठाणे, नवी मुंबई · हिंदी, मराठी"], professional: ["e.g. Mumbai, Pune · English, Hindi", "जैसे: मुंबई, पुणे · अंग्रेज़ी, हिंदी"] } },
  { en: "What kind of work do you want, and when can you start?", hi: "कैसा काम चाहिए, कब से शुरू कर सकते हैं?",
    ex: { skilled: ["e.g. Daily wage or contract, can start now", "जैसे: दिहाड़ी या ठेका, अभी से"], professional: ["e.g. Full-time, 30 days' notice", "जैसे: फुल-टाइम, 30 दिन में"] } },
];

export function ProfileHelper({ lane, onLane, onDraft, onCancel }) {
  const [answers, setAnswers] = useState(["", "", "", "", ""]);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speech = useSpeechInput();

  const hiFirst = lane === "skilled";
  const L = lane === "skilled" ? "skilled" : "professional";
  const big = hiFirst ? { minHeight: 56, fontSize: 17, padding: "12px 18px", borderRadius: 12 } : { minHeight: 46, fontSize: 14 };
  // Two-language text, ordered for the lane.
  const bi = (en, hi, size = 20) => hiFirst ? <>
    <div lang="hi" style={{ fontSize: size + 2, fontWeight: 800, color: "var(--t1)", lineHeight: 1.3 }}>{hi}</div>
    <div style={{ fontSize: Math.max(13, size - 6), color: "var(--t2)", marginTop: 2 }}>{en}</div>
  </> : <>
    <div style={{ fontSize: size, fontWeight: 800, color: "var(--t1)", lineHeight: 1.3 }}>{en}</div>
    <div lang="hi" style={{ fontSize: Math.max(13, size - 6), color: "var(--t3)", marginTop: 2 }}>{hi}</div>
  </>;

  const box = { background: "var(--s2)", borderRadius: 12, padding: 16, marginBottom: 12 };
  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--acc)" }}>✨ {hiFirst ? "मेरे लिए भर दो · Fill it for me" : "Fill it for me · मेरे लिए भर दो"}</div>
      <button type="button" onClick={() => { speech.stop(); onCancel(); }} style={{ ...btnOutline, padding: "6px 10px" }}>{hiFirst ? "बंद करें · Close" : "Close"}</button>
    </div>
  );

  // No lane yet: ask first, so the questions come in the right language.
  if (lane !== "skilled" && lane !== "professional") {
    return <div>
      {header}
      <div style={box}>{bi("What kind of work do you do?", "आप किस तरह का काम करते हैं?")}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" onClick={() => onLane("skilled")} style={{ ...btnPrimary, minHeight: 64, fontSize: 18, borderRadius: 12, background: LANE_COLOR.skilled }}>
          <span lang="hi">कारीगर · मिस्त्री · हेल्पर</span><div style={{ fontSize: 13, fontWeight: 600 }}>Skilled trade (mason, electrician, helper…)</div>
        </button>
        <button type="button" onClick={() => onLane("professional")} style={{ ...btnPrimary, minHeight: 64, fontSize: 16, borderRadius: 12, background: LANE_COLOR.professional }}>
          Professional<div style={{ fontSize: 13, fontWeight: 600 }}>Sales, design, engineering, accounts, management</div>
        </button>
      </div>
    </div>;
  }

  const q = QUESTIONS[i];
  const [exEn, exHi] = q.ex[L];
  const setAnswer = (v) => setAnswers(a => a.map((x, j) => (j === i ? v.slice(0, MAX) : x)));
  const anyAnswer = answers.some(a => a.trim());
  const last = i === QUESTIONS.length - 1;

  const mic = () => {
    if (speech.listening) { speech.stop(); return; }
    const idx = i;
    // Hindi first (it also understands Hindi–English mix); English (India)
    // if the browser can't do Hindi. Professional lane tries English first.
    const langs = L === "skilled" ? ["hi-IN", "en-IN"] : ["en-IN", "hi-IN"];
    speech.start(langs, (text) => setAnswers(a => a.map((x, j) => (j === idx ? (x.trim() ? `${x.trim()} ${text}` : text).slice(0, MAX) : x))));
  };

  const go = (n) => { speech.stop(); setError(""); setI(n); };

  const submit = async () => {
    speech.stop();
    setBusy(true);
    setError("");
    try {
      const { draft, notes } = await suggestJobProfile(answers, lane);
      onDraft(draft, notes);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return <div>
    {header}
    <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
      {hiFirst ? `सवाल ${i + 1} / 5 · Question ${i + 1} of 5` : `Question ${i + 1} of 5`}
    </div>
    <div aria-hidden="true" style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      {QUESTIONS.map((_, j) => <span key={j} style={{ flex: 1, height: 4, borderRadius: 2, background: j <= i ? "var(--acc)" : "var(--b2)" }} />)}
    </div>
    <div style={box}>
      {bi(q.en, q.hi)}
      <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 8 }}>{hiFirst ? <><span lang="hi">{exHi}</span> · {exEn}</> : <>{exEn} · <span lang="hi">{exHi}</span></>}</div>
    </div>
    <label htmlFor={`ph-answer-${i}`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{q.en}</label>
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      <textarea id={`ph-answer-${i}`} className="fta" rows={3} value={answers[i]} onChange={e => setAnswer(e.target.value)} maxLength={MAX}
        placeholder={hiFirst ? "यहाँ लिखें या 🎤 दबाकर बोलें · Type or tap 🎤" : speech.supported ? "Type here, or tap 🎤 and speak" : "Type here"}
        style={{ flex: 1, fontSize: hiFirst ? 17 : 15, minHeight: 96 }} />
      {speech.supported && (
        <button type="button" onClick={mic} aria-pressed={speech.listening} aria-label={speech.listening ? "Stop voice typing" : "Speak your answer"}
          style={{ width: hiFirst ? 64 : 52, flexShrink: 0, borderRadius: 12, fontSize: hiFirst ? 28 : 22, cursor: "pointer",
            border: `2px solid ${speech.listening ? "#dc2626" : "var(--b3)"}`, background: speech.listening ? "#fff0f0" : "var(--s1)" }}>
          {speech.listening ? "⏹" : "🎤"}
        </button>
      )}
    </div>
    {speech.listening && <div role="status" style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, marginTop: 6 }}>● {hiFirst ? "सुन रहे हैं… बोलिए · Listening…" : "Listening… speak now"}</div>}
    {speech.error && <div role="alert" style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>{speech.error}</div>}
    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
      {hiFirst ? "जवाब बदल सकते हैं। फ़ोन नंबर न लिखें। · You can edit the text. Don't add your phone number." : "You can edit the text. Don't add your phone number."}
    </div>
    {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>⚠ {error}</div>}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      {i > 0 ? <button type="button" onClick={() => go(i - 1)} disabled={busy} style={{ ...btnOutline, ...big }}>← {hiFirst ? "पीछे · Back" : "Back"}</button> : <span />}
      {!last
        ? <button type="button" onClick={() => go(i + 1)} style={{ ...btnPrimary, ...big }}>{answers[i].trim() ? (hiFirst ? "आगे · Next" : "Next") : (hiFirst ? "छोड़ें · Skip" : "Skip")} →</button>
        : <button type="button" onClick={submit} disabled={busy || !anyAnswer} style={{ ...btnPrimary, ...big, opacity: busy || !anyAnswer ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? (hiFirst ? "भर रहे हैं… · Filling…" : "Filling…") : (hiFirst ? "✨ प्रोफ़ाइल भरें · Fill my profile" : "✨ Fill my profile")}
          </button>}
    </div>
    {last && !anyAnswer && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6, textAlign: "right" }}>{hiFirst ? "कम से कम एक जवाब दें · Answer at least one question" : "Answer at least one question first."}</div>}
    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 12, borderTop: "1px solid var(--b2)", paddingTop: 8 }}>
      {hiFirst
        ? "सिर्फ़ ये 5 जवाब (आवाज़ नहीं) फ़ॉर्म भरने के लिए AI को भेजे जाते हैं, सेव नहीं होते। आप सब कुछ देखकर ही सेव करेंगे। · Only these 5 answers (no audio) are sent to an AI helper to fill the form. They aren't stored. You check everything before saving."
        : "Only these 5 answers (no audio) are sent to an AI helper to fill the form. They aren't stored. You check everything before saving."}
    </div>
  </div>;
}
