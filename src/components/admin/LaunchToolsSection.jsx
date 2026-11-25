// Admin → Launch tools: one-time data fixes for the 22 Nov 2026 launch.
import { useState } from "react";
import { backfillEntitlements, backfillSearchFields, migrateApplicationContacts } from "../../lib/adminMigrations";

export function LaunchToolsSection() {
  const [state, setState] = useState({ busy: false, result: null, error: "" });
  const [ent, setEnt] = useState({ busy: false, result: null, error: "" });
  const [sea, setSea] = useState({ busy: false, result: null, error: "" });
  const runSea = async () => {
    setSea({ busy: true, result: null, error: "" });
    try { setSea({ busy: false, result: await backfillSearchFields(), error: "" }); }
    catch (e) { console.error("[launch-tools] search fields failed:", e); setSea({ busy: false, result: null, error: e.message || String(e) }); }
  };
  const runEnt = async () => {
    setEnt({ busy: true, result: null, error: "" });
    try { setEnt({ busy: false, result: await backfillEntitlements(), error: "" }); }
    catch (e) { console.error("[launch-tools] entitlements failed:", e); setEnt({ busy: false, result: null, error: e.message || String(e) }); }
  };
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
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16, maxWidth: 640, marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>L9 · Record free profiles and job posts</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 12 }}>
          New profiles and job posts are recorded automatically from now on. This records the ones made before, each valid 365 days from the day it was created, at today’s Pricing settings.
        </div>
        <button type="button" disabled={ent.busy} onClick={runEnt}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {ent.busy ? "Recording…" : "Record existing profiles and jobs"}
        </button>
        {ent.result && <div role="status" style={{ marginTop: 10, fontSize: 13, color: "#15803d" }}>✓ {ent.result.profiles} profiles and {ent.result.jobs} jobs checked, {ent.result.created} recorded.</div>}
        {ent.error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: "#b91c1c" }}>⚠ {ent.error}</div>}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16, maxWidth: 640, marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>A1 · Get profiles ready for employer search</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 12 }}>
          Fills the city and experience search fields on profiles made before employer search. It doesn’t put anyone on search: each person still has to say yes themselves.
        </div>
        <button type="button" disabled={sea.busy} onClick={runSea}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {sea.busy ? "Filling…" : "Fill search fields"}
        </button>
        {sea.result && <div role="status" style={{ marginTop: 10, fontSize: 13, color: "#15803d" }}>✓ Checked {sea.result.scanned} profiles, filled {sea.result.filled}. Said yes: {sea.result.yes} · no: {sea.result.no} · not asked yet: {sea.result.scanned - sea.result.yes - sea.result.no}.</div>}
        {sea.error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: "#b91c1c" }}>⚠ {sea.error}</div>}
      </div>
    </>
  );
}
