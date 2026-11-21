// L6: "Share" for a job — WhatsApp, LinkedIn, Facebook, X, the phone's own
// share sheet (navigator.share: Instagram, Telegram, SMS…) and Copy link.
// Used on the job page and in the Employer Desk. `job` is a normaliseJob() result.
import { useState } from "react";
import { Sheet } from "./desk/Sheet";
import { jobShareText, jobShareUrl, shareLinks } from "../../utils/jobShare.js";

const row = {
  display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "0 14px",
  borderRadius: 12, border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t1)",
  fontSize: 15, fontWeight: 700, textDecoration: "none", cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
};
const dot = (bg) => ({ width: 30, height: 30, borderRadius: 8, background: bg, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 });

export function ShareJobButton({ job, style, label = "Share" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = jobShareUrl(job.id);
  const text = jobShareText(job);
  const links = shareLinks(url, text);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const nativeShare = async () => {
    try { await navigator.share({ title: job.title, text, url }); setOpen(false); }
    catch (e) { if (e?.name !== "AbortError") console.warn("[share] native share failed:", e); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Share this job" style={style}>📤 {label}</button>
      {open && (
        <Sheet title="Share this job" onClose={() => setOpen(false)} width={420}>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>{text}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} style={row}>
                <span style={dot("#e85a2a")}>⇪</span> Share via phone… <span style={{ fontWeight: 400, fontSize: 12, color: "var(--t3)" }}>Instagram, Telegram & more</span>
              </button>
            )}
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" style={row}><span style={dot("#25d366")}>W</span> WhatsApp</a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" style={row}><span style={dot("#0a66c2")}>in</span> LinkedIn</a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" style={row}><span style={dot("#1877f2")}>f</span> Facebook</a>
            <a href={links.x} target="_blank" rel="noopener noreferrer" style={row}><span style={dot("#000")}>X</span> X (Twitter)</a>
            <button type="button" onClick={copy} style={row}>
              <span style={dot(copied ? "#16a34a" : "#555")}>{copied ? "✓" : "🔗"}</span> {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 10, wordBreak: "break-all" }}>{url}</div>
        </Sheet>
      )}
    </>
  );
}
