// Admin → Launch tools: one-time data fixes for the 22 Nov 2026 launch.
import { useState } from "react";
import { migrateApplicationContacts } from "../../lib/adminMigrations";

export function LaunchToolsSection() {
  const [state, setState] = useState({ busy: false, result: null, error: "" });
  const run = async () => {
    setState({ busy: true, result: null, error: "" });
    try { setState({ busy: false, result: await migrateApplicationContacts(), error: "" }); }
    catch (e) { console.error("[launch-tools] migration failed:", e); setState({ busy: false, result: null, error: e.message || String(e) }); }
  };
  return (
    <>
      <div className="admin-hd">
        <div className="admin-title">Launch tools</div>
        <div className="admin-sub">One-time fixes for the launch. Safe to run more than once.</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16, maxWidth: 640 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>L8 · Hide applicant contact until shortlist</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 12 }}>
          Applications sent before the launch still carry the applicant’s phone, email and CV link on the part employers can read.
          This moves them to the private part, so employers see them only after they shortlist. Applications already at Shortlisted or later stay unlocked.
        </div>
        <button type="button" disabled={state.busy} onClick={run}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {state.busy ? "Moving…" : "Move contact details now"}
        </button>
        {state.result && <div role="status" style={{ marginTop: 10, fontSize: 13, color: "#15803d" }}>✓ Checked {state.result.scanned} applications, moved {state.result.moved}.</div>}
        {state.error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: "#b91c1c" }}>⚠ {state.error}</div>}
      </div>
    </>
  );
}
