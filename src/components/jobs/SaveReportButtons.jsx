import { useEffect, useState } from "react";
import { REPORT_REASONS, isJobSaved, reportJob, setJobSaved } from "../../lib/jobsFeed";
import { btnOutline, heading } from "./jobsStyle";

// "Save job" toggle (users/{uid}/savedJobs/{jobId}). Guests get the usual
// login prompt.
export function SaveJobButton({ jobId, user, isGuest, onRequireLogin, toast }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    isJobSaved(user.uid, jobId).then(v => { if (!cancelled) setSaved(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid, jobId]);

  const toggle = async () => {
    if (isGuest || !user?.uid) { onRequireLogin(); return; }
    setBusy(true);
    try {
      await setJobSaved(user.uid, jobId, !saved);
      setSaved(!saved);
      toast?.(saved ? "Removed from saved jobs" : "Saved — find it under Saved jobs", "ok");
    } catch (e) {
      console.error("[jobs] Save failed:", e);
      toast?.("Could not save this job. Please try again.", "err");
    }
    setBusy(false);
  };

  return (
    <button onClick={toggle} disabled={busy} style={{ ...btnOutline, padding: "10px 18px", fontSize: 13 }}>
      {saved ? "★ Saved" : "☆ Save job"}
    </button>
  );
}

// "Report" link + reason picker (jobReports/{jobId}_{uid}, admin-read-only).
export function ReportJobButton({ jobId, user, isGuest, onRequireLogin }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | ok | already | error

  const start = () => {
    if (isGuest || !user?.uid) { onRequireLogin(); return; }
    setReason(""); setState("idle"); setOpen(true);
  };
  const send = async () => {
    if (!reason) return;
    setState("sending");
    try { setState(await reportJob(user.uid, jobId, reason)); }
    catch (e) { console.error("[jobs] Report failed:", e); setState("error"); }
  };

  return (
    <>
      <button onClick={start} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "10px 4px" }}>
        ⚑ Report
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setOpen(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
            {state === "ok" || state === "already" ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#080808" }}>{state === "ok" ? "Thanks — reported" : "You've already reported this job"}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>The TIN team will review this listing.</div>
                <button onClick={() => setOpen(false)} style={{ ...btnOutline, marginTop: 14 }}>Close</button>
              </div>
            ) : <>
              <div style={{ ...heading, fontSize: 20, color: "#080808", marginBottom: 10 }}>Report this job</div>
              {REPORT_REASONS.map(([k, label]) => (
                <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#333", padding: "6px 0", cursor: "pointer" }}>
                  <input type="radio" name="tj-report" checked={reason === k} onChange={() => setReason(k)} /> {label}
                </label>
              ))}
              {state === "error" && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>Could not send the report. Please try again.</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={send} disabled={!reason || state === "sending"}
                  style={{ flex: 1, padding: 9, borderRadius: 8, background: reason ? "#e85a2a" : "#f5f5f5", border: "none", color: reason ? "white" : "#888", fontSize: 13, fontWeight: 700, cursor: reason ? "pointer" : "default" }}>
                  {state === "sending" ? "Sending…" : "Send report"}
                </button>
                <button onClick={() => setOpen(false)} style={{ padding: "9px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </>
  );
}
