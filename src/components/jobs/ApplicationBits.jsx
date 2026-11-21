import { Fragment } from "react";
import { milestoneProgress, stageLabel, stageTone } from "../../utils/applications.js";
import { tinProfileLines } from "../../utils/jobProfile.js";

const TONE_STYLE = {
  g: { color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0" },
  w: { color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a" },
  n: { color: "#334155", background: "#f1f5f9", border: "1px solid #e2e8f0" },
  e: { color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb" },
};

export function StagePill({ stage }) {
  return <span style={{ ...TONE_STYLE[stageTone(stage)], fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{stageLabel(stage)}</span>;
}

// The 6-milestone progress tracker (Submitted · Viewed · Shortlisted ·
// Interview · Selected · Offer). Greys out when closed without an offer.
export function MilestoneTracker({ app }) {
  const { steps, stopped } = milestoneProgress(app);
  return (
    <ol aria-label="Progress" style={{ display: "flex", listStyle: "none", padding: 0, margin: "10px 0", gap: 0 }}>
      {steps.map((s, i) => {
        const color = stopped ? "#9ca3af" : s.reached ? "var(--ok)" : "var(--b3)";
        return (
          <li key={s.label} aria-current={s.current ? "step" : undefined} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
            {i > 0 && <span aria-hidden="true" style={{ position: "absolute", top: 9, right: "50%", width: "100%", height: 2, background: steps[i].reached && !stopped ? "var(--ok)" : "var(--b2)" }} />}
            <span aria-hidden="true" style={{ position: "relative", zIndex: 1, display: "inline-flex", width: 20, height: 20, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", background: s.reached ? color : "var(--s2)", border: s.current ? "2px solid var(--t1)" : "none" }}>
              {s.reached ? "✓" : ""}
            </span>
            <div style={{ fontSize: 10, color: s.reached ? "var(--t1)" : "var(--t3)", fontWeight: s.current ? 800 : 500, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Printable "TIN Profile" — a clean summary built from the candidate's
// profile snapshot. Shown wherever there's no CV (never as a negative).
export function TinProfileCard({ app }) {
  const snap = app.profileSnapshot || {};
  const lines = tinProfileLines(snap);
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(app.applicantName)} — TIN Profile</title>
      <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#111}h1{font-size:22px;margin:0}
      .sub{color:#555;margin:4px 0 16px}dl{display:grid;grid-template-columns:140px 1fr;gap:6px 12px}dt{color:#555;font-weight:600}dd{margin:0}
      .foot{margin-top:24px;font-size:12px;color:#777}</style></head><body>
      <h1>${esc(app.applicantName)}</h1><div class="sub">TIN Profile · ${esc(app.jobSnapshot?.title || "")}</div>
      <dl>${lines.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
      ${app.applicantPhone ? `<dt>Mobile</dt><dd>${esc(app.applicantPhone)}</dd>` : ""}${app.applicantEmail ? `<dt>Email</dt><dd>${esc(app.applicantEmail)}</dd>` : ""}
      ${app.expectedPay ? `<dt>Expected pay</dt><dd>${esc(app.expectedPay)}</dd>` : ""}${app.currentPay ? `<dt>Current pay</dt><dd>${esc(app.currentPay)}</dd>` : ""}</dl>
      <div class="foot">Built from the candidate's TIN profile · tinit.in</div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <div style={{ border: "1px solid var(--b2)", borderRadius: 10, padding: 12, background: "var(--s1)", marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--t2)" }}>TIN Profile</div>
        <button type="button" onClick={print} style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", background: "none", border: "none", cursor: "pointer" }}>🖨 Print / save PDF</button>
      </div>
      {lines.length ? (
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(90px, auto) 1fr", gap: "4px 10px", margin: 0, fontSize: 13 }}>
          {lines.map(([k, v]) => <Fragment key={k}><dt style={{ color: "var(--t3)" }}>{k}</dt><dd style={{ margin: 0, color: "var(--t1)" }}>{v}</dd></Fragment>)}
        </dl>
      ) : <div style={{ fontSize: 13, color: "var(--t3)" }}>Basic profile — name, contact and city above.</div>}
    </div>
  );
}
