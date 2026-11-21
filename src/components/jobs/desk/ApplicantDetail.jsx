import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  INTERVIEW_MODES, cleanInterview, currentStage, interviewComplete, isContactUnlocked, isFinal, stageLabel,
} from "../../../utils/applications.js";
import { defaultNote, moveOptions, nextAction } from "../../../utils/employerDesk.js";
import { loadApplicationContact, moveApplication, openApplicationCv } from "../../../lib/applications";
import { messageAboutApplication } from "../../../lib/jobMessages";
import { MilestoneTracker, StagePill, TinProfileCard } from "../ApplicationBits";

const big = { minHeight: 44, padding: "0 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const primary = { ...big, background: "#e85a2a", color: "#fff", border: "none" };
const outline = { ...big, background: "transparent", color: "var(--t1)", border: "1px solid var(--b3)" };
const label = { fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "14px 0 6px" };
const fmtDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null)?.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) || "";
const ASKS = ["info_req", "assess_req"]; // these also send the request as a message
const INTERVIEW_NOW = ["int_invited", "int_scheduled", "int_rescheduled"];

// Everything about one application, for the job's employer: TIN Profile,
// contact + CV (L8: only once shortlisted — locked before that), stage
// moves the employer may set, interview invite, and Message (TIN
// Conversations). Used inside a Sheet.
export function ApplicantDetail({ app, job, employer, onChange, startWith = null }) {
  const navigate = useNavigate();
  const [moveTo, setMoveTo] = useState(startWith === "invite" ? "" : startWith || "");
  const [note, setNote] = useState(startWith && startWith !== "invite" ? defaultNote(startWith, job?.lane) : "");
  const [showInvite, setShowInvite] = useState(startWith === "invite");
  const [iv, setIv] = useState({ date: "", time: "", mode: "In person", where: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null); // conversation id after a message went out

  const stage = currentStage(app);
  const final = isFinal(stage);
  // L8: phone / email / CV come from the private contact doc once unlocked.
  const unlocked = isContactUnlocked(app);
  const [contactState, setContactState] = useState({ id: null, contact: null });
  useEffect(() => {
    let cancelled = false;
    loadApplicationContact(app).then(c => { if (!cancelled) setContactState({ id: `${app.id}:${unlocked}`, contact: c }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the app or its lock state changes
  }, [app.id, unlocked]);
  const contact = contactState.id === `${app.id}:${unlocked}` ? contactState.contact : null;
  const withContact = contact ? { ...app, ...contact } : app;
  const hasCv = !!(contact?.resumePath || contact?.resumeUrl);
  const cvAttached = hasCv || !!app.hasCv;
  const next = nextAction(app);
  const options = moveOptions(app);
  const asking = ASKS.includes(moveTo);

  const msg = (text = "") => messageAboutApplication({
    myUid: employer.uid, myName: employer.name, otherUid: app.applicantUid, otherName: app.applicantName, app, text,
  });

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) {
      console.error("[desk] update failed:", e);
      // L10: at the shortlist limit, show the owner's message as-is.
      setError(e?.name === "ShortlistFullError" ? e.message : "Couldn't update: " + (e.message || e));
    }
    setBusy(false);
  };

  const pick = (s) => { setMoveTo(s); setNote(defaultNote(s, job?.lane)); setShowInvite(false); };

  const doMove = (to, n = note) => run(async () => {
    if (ASKS.includes(to) && !n.trim()) throw new Error("Write what you need from them.");
    const updated = await moveApplication(app, to, "employer", employer.uid, { note: n });
    onChange(updated);
    setMoveTo(""); setNote("");
    if (ASKS.includes(to)) setSent(await msg(n));
  });

  const invite = () => {
    const i = cleanInterview(iv);
    if (!interviewComplete(i)) { setError("Add the date, time and (for in-person) the place."); return; }
    const to = INTERVIEW_NOW.includes(stage) ? "int_rescheduled" : "int_invited";
    run(async () => {
      onChange(await moveApplication(app, to, "employer", employer.uid, { interview: i, note }));
      setShowInvite(false); setNote("");
    });
  };

  const openChat = () => run(async () => navigate(`/conversations/${await msg()}`));

  const openCv = async () => {
    const win = window.open("", "_blank");
    try { await openApplicationCv(withContact, win); }
    catch (e) { if (win) win.close(); setError("Couldn't open the CV: " + (e.message || e)); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--t1)" }}>{app.applicantName || "Applicant"}</div>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>
            {[app.profileSnapshot?.role, app.profileSnapshot?.city, app.createdAt ? `applied ${fmtDate(app.createdAt)}` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
        <StagePill stage={stage} />
      </div>
      <MilestoneTracker app={app} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {contact?.applicantPhone && <a href={`tel:${contact.applicantPhone}`} style={{ ...outline, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>📞 Call</a>}
        {stage !== "withdrawn" && <button type="button" disabled={busy} onClick={openChat} style={outline}>💬 Message</button>}
        {hasCv && <button type="button" onClick={openCv} style={outline}>📄 CV</button>}
      </div>
      {unlocked ? (
        <>
          <div style={{ fontSize: 13, color: "var(--t1)", display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8 }}>
            {contact?.applicantPhone && <span>{contact.applicantPhone}</span>}
            {contact?.applicantEmail && <a href={`mailto:${contact.applicantEmail}`} style={{ color: "var(--t1)" }}>{contact.applicantEmail}</a>}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Phone, email and CV are shown because you shortlisted this applicant.</div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: "var(--t2)", background: "var(--s2)", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
          🔒 Phone, email{cvAttached ? " and CV" : ""} unlock when you shortlist this applicant. You can message them on TIN any time.
          {cvAttached && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>📄 CV attached</div>}
        </div>
      )}
      {(app.expectedPay || app.currentPay) && (
        <div style={{ fontSize: 13, color: "var(--t1)", display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8 }}>
          {app.expectedPay && <span>Expected pay: {app.expectedPay}</span>}
          {app.currentPay && <span>Current pay: {app.currentPay}</span>}
        </div>
      )}
      {app.message && <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 8 }}>“{app.message}”</div>}
      {sent && (
        <div style={{ fontSize: 13, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 8, marginTop: 8 }}>
          Sent in Messages. <button type="button" onClick={() => navigate(`/conversations/${sent}`)} style={{ background: "none", border: "none", color: "var(--acc)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Open chat →</button>
        </div>
      )}

      {app.interview?.date && [...INTERVIEW_NOW, "int_done"].includes(stage) && (
        <div style={{ fontSize: 13, color: "var(--t1)", marginTop: 10, background: "var(--s2)", borderRadius: 8, padding: 10 }}>
          <b>Interview:</b> {app.interview.date} · {app.interview.time} · {app.interview.mode}{app.interview.where ? ` · ${app.interview.where}` : ""}
          {app.interview.instructions ? <div style={{ color: "var(--t2)" }}>{app.interview.instructions}</div> : null}
        </div>
      )}
      {app.interviewResponse?.type === "reschedule_request" && ["int_invited", "int_rescheduled"].includes(stage) && (
        <div style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8, marginTop: 8 }}>
          Asked for another time{app.interviewResponse.note ? `: “${app.interviewResponse.note}”` : "."}
          <button type="button" onClick={() => { setShowInvite(true); setMoveTo(""); }} style={{ display: "block", marginTop: 6, background: "none", border: "none", padding: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer" }}>Send a new time →</button>
        </div>
      )}

      {final ? (
        <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 14 }}>This application is closed: <b>{stageLabel(stage)}</b>.</div>
      ) : (
        <>
          {next && !moveTo && !showInvite && (
            <button type="button" disabled={busy} style={{ ...primary, width: "100%", marginTop: 14 }}
              onClick={() => (next.action === "invite" ? setShowInvite(true) : doMove(next.stage, ""))}>
              {next.label}
            </button>
          )}

          {showInvite && (
            <div style={{ background: "var(--s2)", borderRadius: 10, padding: 10, display: "grid", gap: 8, marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{INTERVIEW_NOW.includes(stage) ? "New interview time" : "Invite to interview"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input className="fi" type="date" value={iv.date} onChange={e => setIv({ ...iv, date: e.target.value })} aria-label="Interview date" style={{ flex: "1 1 140px" }} />
                <input className="fi" type="time" value={iv.time} onChange={e => setIv({ ...iv, time: e.target.value })} aria-label="Interview time" style={{ flex: "1 1 110px" }} />
                <select className="fi" value={iv.mode} onChange={e => setIv({ ...iv, mode: e.target.value })} aria-label="Interview mode" style={{ flex: "1 1 130px" }}>
                  {INTERVIEW_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <input className="fi" value={iv.where} onChange={e => setIv({ ...iv, where: e.target.value })} placeholder={iv.mode === "In person" ? "Place / address" : "Number or link (optional)"} />
              <input className="fi" value={iv.instructions} onChange={e => setIv({ ...iv, instructions: e.target.value })} placeholder="What to bring, who to ask for (optional)" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={invite} disabled={busy} style={primary}>Send invitation</button>
                <button type="button" onClick={() => setShowInvite(false)} style={outline}>Cancel</button>
              </div>
            </div>
          )}

          <div style={label}>Move to</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {options.map(s => (
              <button key={s} type="button" onClick={() => pick(s)} aria-pressed={moveTo === s}
                style={{ minHeight: 40, padding: "0 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  border: moveTo === s ? "1px solid var(--acc)" : "1px solid var(--b2)", background: moveTo === s ? "#e85a2a14" : "var(--s2)", color: moveTo === s ? "var(--acc)" : "var(--t2)" }}>
                {stageLabel(s)}
              </button>
            ))}
            {!showInvite && (
              <button type="button" onClick={() => { setShowInvite(true); setMoveTo(""); }}
                style={{ minHeight: 40, padding: "0 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--b2)", background: "var(--s2)", color: "var(--t2)", fontFamily: "inherit" }}>
                {INTERVIEW_NOW.includes(stage) ? "Reschedule interview" : "Interview invite"}
              </button>
            )}
          </div>
          {moveTo && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <textarea className="fta" rows={asking ? 3 : 2} value={note} onChange={e => setNote(e.target.value)}
                placeholder={asking ? (moveTo === "info_req" ? "What do you need from them? e.g. a photo of your work, ID proof" : "What should they do? e.g. tile a 2×2 ft sample on Saturday") : "Note for the candidate (optional)"} />
              {asking && <div style={{ fontSize: 12, color: "var(--t3)" }}>This is also sent to them in Messages, where they can reply.</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => doMove(moveTo)} style={primary}>Move to {stageLabel(moveTo)}</button>
                <button type="button" onClick={() => { setMoveTo(""); setNote(""); }} style={outline}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 8 }}>⚠ {error}</div>}

      {(!hasCv || app.profileSnapshot) && <TinProfileCard app={withContact} />}

      {(app.stageHistory || []).length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", cursor: "pointer" }}>Timeline</summary>
          <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--t2)" }}>
            {[...app.stageHistory].reverse().map((e, i) => (
              <li key={i} style={{ whiteSpace: "pre-line" }}>{stageLabel(e.stage)} · {fmtDate(e.at)}{e.note ? ` — “${e.note}”` : ""}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
