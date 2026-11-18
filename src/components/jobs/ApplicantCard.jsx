import { useState } from "react";
import {
  INTERVIEW_MODES, cleanInterview, currentStage, employerStageOptions, interviewComplete, isFinal, shouldMarkViewed, stageLabel,
} from "../../utils/applications.js";
import { moveApplication, openApplicationCv } from "../../lib/applications";
import { MilestoneTracker, StagePill, TinProfileCard } from "./ApplicationBits";

const small = { fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer" };
const fmtDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null)?.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) || "";

// One applicant, for the job's employer (My Jobs and the Profile page).
// Phase 4 minimum: contact details (copied in because they applied), CV or
// TIN Profile card, stage moves the employer may set (EMP_SET), and an
// interview invite / reschedule. Opening it records "Application Viewed".
export function ApplicantCard({ app: initial, employerUid }) {
  const [app, setApp] = useState(initial);
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [note, setNote] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [iv, setIv] = useState({ date: "", time: "", mode: "In person", where: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stage = currentStage(app);
  const final = isFinal(stage);
  const hasCv = !!(app.resumePath || app.resumeUrl);

  const run = async (fn) => {
    setBusy(true); setError("");
    try { setApp(await fn()); } catch (e) { console.error("[applicant] update failed:", e); setError("Couldn't update: " + (e.message || e)); }
    setBusy(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && shouldMarkViewed(app)) {
      moveApplication(app, "app_viewed", "employer", employerUid).then(setApp).catch(e => console.warn("[applicant] mark viewed failed:", e));
    }
  };

  const openCv = async () => {
    const win = window.open("", "_blank");
    try { await openApplicationCv(app, win); }
    catch (e) { if (win) win.close(); setError("Couldn't open the CV: " + (e.message || e)); }
  };

  const invite = () => {
    const i = cleanInterview(iv);
    if (!interviewComplete(i)) { setError("Add the date, time and (for in-person) the place."); return; }
    const to = ["int_invited", "int_scheduled", "int_rescheduled"].includes(stage) ? "int_rescheduled" : "int_invited";
    run(() => moveApplication(app, to, "employer", employerUid, { interview: i, note }));
    setShowInvite(false); setNote("");
  };

  return (
    <div style={{ background: "var(--s2)", borderRadius: 10, padding: "10px 12px", marginTop: 6 }}>
      <button type="button" onClick={toggle} aria-expanded={open}
        style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
          {app.applicantName || "Applicant"}
          <span style={{ fontWeight: 400, color: "var(--t3)" }}>{app.createdAt ? ` · applied ${fmtDate(app.createdAt)}` : ""}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><StagePill stage={stage} /><span aria-hidden="true">{open ? "▲" : "▼"}</span></span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <MilestoneTracker app={app} />
          <div style={{ fontSize: 13, color: "var(--t1)", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
            {app.applicantPhone && <a href={`tel:${app.applicantPhone}`} style={{ color: "var(--t1)" }}>📞 {app.applicantPhone}</a>}
            {app.applicantEmail && <a href={`mailto:${app.applicantEmail}`} style={{ color: "var(--t1)" }}>✉ {app.applicantEmail}</a>}
            {app.expectedPay && <span>Expected pay: {app.expectedPay}</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Contact details are shown because they applied to your job.</div>
          {app.message && <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 6 }}>“{app.message}”</div>}

          {hasCv && (
            <button type="button" onClick={openCv} style={{ ...small, marginTop: 8, background: "transparent", border: "1px solid var(--b3)", color: "#1D4ED8" }}>
              📄 Open CV{app.resumeFileName ? ` (${app.resumeFileName})` : ""}
            </button>
          )}
          {(!hasCv || app.profileSnapshot) && <TinProfileCard app={app} />}

          {app.interview?.date && ["int_invited", "int_scheduled", "int_rescheduled", "int_done"].includes(stage) && (
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 8, background: "var(--s1)", borderRadius: 8, padding: 8 }}>
              <b>Interview:</b> {app.interview.date} · {app.interview.time} · {app.interview.mode}{app.interview.where ? ` · ${app.interview.where}` : ""}
              {app.interview.instructions ? <div>{app.interview.instructions}</div> : null}
            </div>
          )}
          {app.interviewResponse?.type === "reschedule_request" && ["int_invited", "int_rescheduled"].includes(stage) && (
            <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8, marginTop: 8 }}>
              Asked for another time{app.interviewResponse.note ? `: “${app.interviewResponse.note}”` : "."} Use “Reschedule interview” below.
            </div>
          )}

          {final ? (
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 10 }}>This application is closed: <b>{stageLabel(stage)}</b>.</div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <select className="fi" style={{ flex: "1 1 180px", maxWidth: 260 }} value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label="Move to stage">
                  <option value="">Move to…</option>
                  {employerStageOptions(app).map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
                </select>
                <button type="button" disabled={!moveTo || busy}
                  onClick={() => run(() => moveApplication(app, moveTo, "employer", employerUid, { note })).then(() => { setMoveTo(""); setNote(""); })}
                  style={{ ...small, background: moveTo ? "#e85a2a" : "var(--s1)", color: moveTo ? "#fff" : "var(--t3)", border: "none" }}>Update</button>
                <button type="button" onClick={() => setShowInvite(v => !v)} style={{ ...small, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)" }}>
                  {["int_invited", "int_scheduled", "int_rescheduled"].includes(stage) ? "Reschedule interview" : "Invite to interview"}
                </button>
              </div>
              <input className="fi" value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the candidate (optional)" />
              {showInvite && (
                <div style={{ background: "var(--s1)", borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input className="fi" type="date" value={iv.date} onChange={e => setIv({ ...iv, date: e.target.value })} aria-label="Interview date" style={{ flex: "1 1 140px" }} />
                    <input className="fi" type="time" value={iv.time} onChange={e => setIv({ ...iv, time: e.target.value })} aria-label="Interview time" style={{ flex: "1 1 110px" }} />
                    <select className="fi" value={iv.mode} onChange={e => setIv({ ...iv, mode: e.target.value })} aria-label="Interview mode" style={{ flex: "1 1 130px" }}>
                      {INTERVIEW_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <input className="fi" value={iv.where} onChange={e => setIv({ ...iv, where: e.target.value })} placeholder={iv.mode === "In person" ? "Place / address" : "Number or link (optional)"} />
                  <input className="fi" value={iv.instructions} onChange={e => setIv({ ...iv, instructions: e.target.value })} placeholder="What to bring, who to ask for (optional)" />
                  <button type="button" onClick={invite} disabled={busy} style={{ ...small, background: "#e85a2a", color: "#fff", border: "none", justifySelf: "start" }}>Send invitation</button>
                </div>
              )}
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>⚠ {error}</div>}
        </div>
      )}
    </div>
  );
}
