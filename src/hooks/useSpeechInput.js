// Voice typing with the browser's built-in speech-to-text (Web Speech API).
// The browser turns speech into text; TIN never receives, sends or stores
// audio — only the resulting text lands in the answer box, where the user
// can edit it. Unsupported browser → `supported` is false and the caller
// hides the mic button (typing still works).
import { useCallback, useEffect, useRef, useState } from "react";

const getRecognition = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

const ERRORS = {
  "not-allowed": "Microphone is blocked. Allow it in your browser, or type. · माइक बंद है, टाइप करें।",
  "service-not-allowed": "Voice typing isn't available here. Please type. · यहाँ बोलकर नहीं लिख सकते, टाइप करें।",
  "audio-capture": "No microphone found. Please type. · माइक नहीं मिला, टाइप करें।",
  "no-speech": "Didn't hear anything. Tap 🎤 and speak. · कुछ सुनाई नहीं दिया, फिर बोलें।",
  network: "Voice typing needs internet. Please type. · इंटरनेट चाहिए, टाइप करें।",
};

export function useSpeechInput() {
  const [supported] = useState(() => !!getRecognition());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* already stopped */ } }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  // langs: tried in order; the next one is used only if the browser says the
  // language isn't supported. onText gets the final recognised text.
  const start = useCallback((langs, onText) => {
    const Recognition = getRecognition();
    if (!Recognition) return;
    try { recRef.current?.abort(); } catch { /* ignore */ }
    setError("");
    const run = (i) => {
      const rec = new Recognition();
      rec.lang = langs[i];
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = Array.from(e.results || []).map(r => r?.[0]?.transcript || "").join(" ").trim();
        if (text) onText(text);
      };
      rec.onerror = (e) => {
        if (e.error === "language-not-supported" && i + 1 < langs.length) { run(i + 1); return; }
        if (e.error !== "aborted") setError(ERRORS[e.error] || "Voice typing stopped. Please try again or type. · फिर कोशिश करें या टाइप करें।");
      };
      rec.onend = () => { if (recRef.current === rec) setListening(false); };
      recRef.current = rec;
      try { rec.start(); setListening(true); } catch { setListening(false); }
    };
    run(0);
  }, []);

  return { supported, listening, error, start, stop };
}
