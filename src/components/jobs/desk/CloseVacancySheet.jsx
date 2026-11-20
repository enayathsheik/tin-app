import { useState } from "react";
import { closePlan, defaultNote } from "../../../utils/employerDesk.js";
import { closeVacancy } from "../../../lib/employerDesk";
import { Sheet } from "./Sheet";

const big = { minHeight: 46, padding: "0 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

// One confirmed action: the job becomes Filled or Closed, and open
// applications move to "closed" with a polite (editable) note. Closing as
// Filled keeps Selected / Offer sent / Offer accepted as they are.
export function CloseVacancySheet({ job, apps, employerUid, onClose, onDone }) {
  const [jobStatus, setJobStatus] = useState("filled");
  const [note, setNote] = useState(defaultNote("closed", job.lane));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const plan = closePlan(apps, jobStatus);
  const n = plan.close.length;

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      const closed = await closeVacancy(job.id, jobStatus, plan.close, employerUid, note);
      onDone(jobStatus, closed);
    } catch (e) {
      console.error("[desk] close vacancy failed:", e);
      setError("Couldn't close the job: " + (e.message || e));
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Close “${job.title}”`} onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["filled", "✓ I hired someone"], ["closed", "Close without hiring"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setJobStatus(k)} aria-pressed={jobStatus === k}
            style={{ ...big, flex: 1, border: jobStatus === k ? "2px solid var(--acc)" : "1px solid var(--b2)", background: jobStatus === k ? "#e85a2a14" : "var(--s2)", color: jobStatus === k ? "var(--acc)" : "var(--t2)" }}>{l}</button>
        ))}
      </div>
      <div style={{ fontSize: 15, color: "var(--t1)", fontWeight: 700 }}>
        {n ? `${n} applicant${n === 1 ? "" : "s"} will get this message:` : "No open applications to close."}
      </div>
      {n > 0 && <textarea className="fta" rows={4} value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 8 }} aria-label="Message to applicants" />}
      {jobStatus === "filled" && plan.kept.length > 0 && (
        <div style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8, marginTop: 10 }}>
          {plan.kept.length} selected / hired {plan.kept.length === 1 ? "person stays" : "people stay"} as they are
          {plan.pendingOffers ? ` (${plan.pendingOffers} offer${plan.pendingOffers === 1 ? "" : "s"} still pending)` : ""}.
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 10 }}>The job stops showing on TIN Jobs. You can reopen it later.</div>
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 8 }}>⚠ {error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" disabled={busy} onClick={confirm} style={{ ...big, background: "#b45309", color: "#fff", border: "none", flex: 1 }}>
          {busy ? "Closing…" : n ? `Close and tell ${n}` : "Close job"}
        </button>
        <button type="button" onClick={onClose} style={{ ...big, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)" }}>Cancel</button>
      </div>
    </Sheet>
  );
}
