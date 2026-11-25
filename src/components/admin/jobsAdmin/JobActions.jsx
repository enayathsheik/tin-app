// Super admin actions on one job: pause / resume / close (the Employer Desk's
// own logic) and delete (admin only in firestore.rules).
import { useState } from "react";
import { loadApplicants } from "../../../lib/applications";
import { setJobStatus } from "../../../lib/employerDesk";
import { deleteJob } from "../../../lib/jobsAdmin";
import { adminUid } from "../../../lib/superAdmin";
import { closePlan, defaultNote } from "../../../utils/employerDesk.js";
import { normaliseJob } from "../../../utils/jobModel.js";
import { CloseVacancySheet } from "../../jobs/desk/CloseVacancySheet";
import { Sheet } from "../../jobs/desk/Sheet";

const btn = { padding: "4px 10px" };
const danger = { ...btn, color: "#b91c1c", borderColor: "#fecaca" };

export function JobActions({ job, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null); // { kind: "close" | "delete", apps }
  const approved = job.raw.status === "approved";

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) {
      console.error("[jobs-admin] job action failed:", e);
      setError("Didn't work: " + (e.message || e));
    }
    setBusy(false);
  };
  const status = (s) => run(async () => { await setJobStatus(job.id, s); onChanged(false); });
  // Applicants are read again so nobody who applied a minute ago is missed.
  const open = (kind) => run(async () => setSheet({ kind, apps: await loadApplicants(job.id) }));
  const done = (deleted) => { setSheet(null); onChanged(deleted); };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {approved && job.state === "open" && <button type="button" className="btn-sm btn-out" style={btn} disabled={busy} onClick={() => status("paused")}>Pause</button>}
        {approved && job.state === "paused" && <button type="button" className="btn-sm btn-out" style={btn} disabled={busy} onClick={() => status("live")}>Resume</button>}
        {approved && (job.state === "open" || job.state === "paused") && <button type="button" className="btn-sm btn-out" style={{ ...btn, color: "#b45309" }} disabled={busy} onClick={() => open("close")}>Close</button>}
        <button type="button" className="btn-sm btn-out" style={danger} disabled={busy} onClick={() => open("delete")}>Delete</button>
      </div>
      {error && <div role="alert" style={{ color: "#b91c1c", fontSize: 11, marginTop: 4 }}>⚠ {error}</div>}
      {sheet?.kind === "close" && <CloseVacancySheet job={normaliseJob(job.raw)} apps={sheet.apps} employerUid={adminUid()} onClose={() => setSheet(null)} onDone={() => done(false)} />}
      {sheet?.kind === "delete" && <DeleteSheet job={job} apps={sheet.apps} onClose={() => setSheet(null)} onDone={() => done(true)} />}
    </div>
  );
}

function DeleteSheet({ job, apps, onClose, onDone }) {
  const [note, setNote] = useState(defaultNote("closed", job.raw.lane));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = closePlan(apps, "closed").close.length;
  const confirm = async () => {
    setBusy(true); setError("");
    try { await deleteJob(job.id, adminUid(), note); onDone(); } catch (e) {
      console.error("[jobs-admin] delete failed:", e);
      setError("Couldn't delete the job: " + (e.message || e));
      setBusy(false);
    }
  };
  return (
    <Sheet title={`Delete “${job.title}”`} onClose={onClose}>
      <div style={{ fontSize: 14, color: "var(--t1)", lineHeight: 1.5 }}>
        The job is removed for good. <b>This can't be undone.</b> {job.employer || "The employer"} will no longer see it or
        its {apps.length} application{apps.length === 1 ? "" : "s"}, including contacts already unlocked. Applicants keep it in their own list.
      </div>
      {n > 0 && (
        <>
          <div style={{ fontSize: 14, color: "var(--t1)", fontWeight: 700, marginTop: 12 }}>{n} open application{n === 1 ? "" : "s"} will be closed with this message:</div>
          <textarea className="fta" rows={4} value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 8 }} aria-label="Message to applicants" />
        </>
      )}
      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 10 }}>To stop applications but keep the records, use Close instead.</div>
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 8 }}>⚠ {error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn-sm" disabled={busy} onClick={confirm} style={{ background: "#b91c1c", color: "#fff", minHeight: 44, flex: 1 }}>{busy ? "Deleting…" : "Delete job for good"}</button>
        <button type="button" className="btn-sm btn-out" disabled={busy} onClick={onClose} style={{ minHeight: 44 }}>Cancel</button>
      </div>
    </Sheet>
  );
}
