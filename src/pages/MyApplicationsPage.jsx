import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { loadMyApplications, moveApplication, requestReschedule } from "../lib/applications";
import { messageAboutApplication } from "../lib/jobMessages";
import { candidateActions, currentStage, isFromSearch, nextStep, stageLabel, stageText } from "../utils/applications.js";
import { normaliseJob } from "../utils/jobModel.js";
import { HI } from "../data/jobsHindi.js";
import { JobsStyles } from "../components/jobs/jobsUi";
import { btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { MilestoneTracker, StagePill } from "../components/jobs/ApplicationBits";

const big = { minHeight: 46, padding: "0 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const fmt = (ts) => (ts?.toDate ? ts.toDate() : null)?.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) || "";
const bil = (key, bi) => (bi ? `${HI[key][1]} · ${HI[key][0]}` : HI[key][0]);

function ApplicationItem({ app: initial, uid }) {
  const [app, setApp] = useState(initial);
  const [open, setOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [rsNote, setRsNote] = useState("");
  const [showRs, setShowRs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const stage = currentStage(app);
  const acts = candidateActions(app);
  const job = app.job ? normaliseJob(app.job) : null;
  const bi = (job?.lane || app.profileSnapshot?.lane) === "skilled";
  const title = job?.title || app.jobSnapshot?.title || "Job";
  const biz = job?.businessName || app.jobSnapshot?.businessName || "";
  const next = nextStep(stage);
  const found = isFromSearch(app); // A2: the employer found them, they didn't apply
  const withdrawText = found ? (bi ? "रुचि नहीं है · Not interested" : "Not interested") : bil("withdraw", bi);
  const contactLater = stage === "info_req" || stage === "assess_req";

  const run = async (fn) => {
    setBusy(true); setError("");
    try { setApp(await fn()); } catch (e) { console.error("[my-apps] update failed:", e); setError("Couldn't update: " + (e.message || e)); }
    setBusy(false);
  };
  const move = (to) => run(() => moveApplication(app, to, "candidate", uid));
  // TIN Conversations with the job's poster — applying is the consent, so
  // the chat opens both ways straight away (no request step).
  const employerUid = app.job?.postedByUid;
  const canMessage = !!employerUid && stage !== "withdrawn";
  const messageEmployer = async () => {
    setBusy(true); setError("");
    try {
      const id = await messageAboutApplication({ myUid: uid, myName: app.applicantName, otherUid: employerUid, otherName: biz, app });
      navigate(`/conversations/${id}`);
    } catch (e) {
      console.error("[my-apps] message failed:", e);
      setError("Couldn't open messages: " + (e.message || e));
      setBusy(false);
    }
  };

  return (
    <div style={{ ...card, padding: 14 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>{biz}{app.createdAt ? ` · ${found ? "shortlisted" : "applied"} ${fmt(app.createdAt)}` : ""}</div>
            {found && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d", marginTop: 4 }}>
                {bi && <span lang="hi" style={{ display: "block" }}>📞 {biz || "एक नौकरी देने वाले"} ने आपको “{title}” के लिए शॉर्टलिस्ट किया है।</span>}
                {bi ? "" : "📞 "}An employer shortlisted you for “{title}”.
              </div>
            )}
          </div>
          <StagePill stage={stage} />
        </div>
        <MilestoneTracker app={app} />
        {next && <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>● Next: {next}</div>}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--t2)" }}>{stageText(stage)}</div>
          {found && acts.withdraw && (
            <div style={{ fontSize: 12, color: "var(--t2)", background: "var(--s2)", borderRadius: 8, padding: 8 }}>
              {bi && <span lang="hi" style={{ display: "block" }}>इस नौकरी देने वाले ने आपकी प्रोफ़ाइल ढूँढी। वह आपका फ़ोन नंबर, ईमेल और CV देख सकता है।</span>}
              This employer found your profile and can see your phone number, email and CV. <Link to="/jobs/profile" style={{ color: "var(--acc)", fontWeight: 700 }}>{bi ? "बदलें · Change who can find you" : "Change who can find you"}</Link>
            </div>
          )}
          {contactLater && <div style={{ fontSize: 13, color: "var(--t2)", background: "var(--s2)", borderRadius: 8, padding: 8 }}>The employer's request is in Messages. Reply there.</div>}
          {canMessage && (
            <button type="button" disabled={busy} onClick={messageEmployer} style={{ ...big, background: contactLater ? "#e85a2a" : "transparent", color: contactLater ? "#fff" : "var(--t1)", border: contactLater ? "none" : "1px solid var(--b3)", alignSelf: "flex-start" }}>
              💬 {bi ? "मालिक को संदेश · Message employer" : "Message employer"}
            </button>
          )}

          {app.interview?.date && ["int_invited", "int_scheduled", "int_rescheduled"].includes(stage) && (
            <div style={{ fontSize: 13, background: "var(--s2)", borderRadius: 10, padding: 10, color: "var(--t1)" }}>
              <b>Interview</b><div>{app.interview.date} · {app.interview.time} · {app.interview.mode}</div>
              {app.interview.where && <div>📍 {app.interview.where}</div>}
              {app.interview.instructions && <div style={{ color: "var(--t2)" }}>{app.interview.instructions}</div>}
            </div>
          )}

          {acts.acceptInterview && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => move("int_scheduled")} style={{ ...big, background: "#e85a2a", color: "#fff", border: "none" }}>{bil("acceptInterview", bi)}</button>
              {acts.requestReschedule && <button disabled={busy} onClick={() => setShowRs(v => !v)} style={{ ...big, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)" }}>{bil("anotherTime", bi)}</button>}
              <button disabled={busy} onClick={() => setConfirmWithdraw(true)} style={{ ...big, background: "transparent", border: "1px solid var(--b3)", color: "var(--t2)" }}>{bil("decline", bi)}</button>
            </div>
          )}
          {showRs && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="fi" style={{ flex: "1 1 220px", minHeight: 46 }} value={rsNote} onChange={e => setRsNote(e.target.value)} placeholder="Times that work for you, e.g. any weekday after 4 pm" />
              <button disabled={busy} onClick={() => run(() => requestReschedule(app, rsNote)).then(() => setShowRs(false))} style={{ ...big, background: "#e85a2a", color: "#fff", border: "none" }}>Send</button>
            </div>
          )}
          {app.interviewResponse?.type === "reschedule_request" && ["int_invited", "int_rescheduled"].includes(stage) && !showRs && (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>You asked for another time. The employer will send a new one.</div>
          )}

          {acts.answerOffer && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => move("offer_accepted")} style={{ ...big, background: "#e85a2a", color: "#fff", border: "none" }}>{bil("acceptOffer", bi)}</button>
              <button disabled={busy} onClick={() => move("offer_declined")} style={{ ...big, background: "transparent", border: "1px solid var(--b3)", color: "var(--t2)" }}>{bil("declineOffer", bi)}</button>
            </div>
          )}

          {(app.stageHistory || []).length > 0 && (
            <details>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", cursor: "pointer" }}>Timeline</summary>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--t2)" }}>
                {[...app.stageHistory].reverse().map((e, i) => (
                  <li key={i} style={{ whiteSpace: "pre-line" }}>{stageLabel(e.stage)} · {fmt(e.at)}{e.note ? ` — “${e.note}”` : ""}</li>
                ))}
              </ol>
            </details>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {job && <Link to={`/jobs/${app.jobId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>View job →</Link>}
            {acts.withdraw && !confirmWithdraw && (
              <button onClick={() => setConfirmWithdraw(true)} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{withdrawText}</button>
            )}
          </div>
          {confirmWithdraw && acts.withdraw && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 10, fontSize: 13 }}>
              {found
                ? <>{bi ? "पक्का? नौकरी देने वाला अब आपका CV नहीं खोल पाएगा, पर आपका नंबर वह देख चुका हो सकता है। · " : ""}Tell the employer you’re not interested? They will no longer be able to open your CV, but may already have seen your phone number.</>
                : <>{bi ? "पक्का? इसके बाद यह आवेदन बंद हो जाएगा। · " : ""}Withdraw this application? The employer will no longer be able to open your CV.</>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button disabled={busy} onClick={() => move("withdrawn").then(() => setConfirmWithdraw(false))} style={{ ...big, background: "#b45309", color: "#fff", border: "none" }}>{found ? (bi ? "हाँ, रुचि नहीं है · Yes, not interested" : "Yes, not interested") : bi ? "हाँ, वापस लें · Yes, withdraw" : "Yes, withdraw"}</button>
                <button onClick={() => setConfirmWithdraw(false)} style={{ ...big, background: "transparent", border: "1px solid var(--b3)", color: "var(--t1)" }}>{bi ? "नहीं · No" : "Keep it"}</button>
              </div>
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 12, color: "#b91c1c" }}>⚠ {error}</div>}
        </div>
      )}
    </div>
  );
}

// /jobs/applications — the candidate's applications with progress.
export function MyApplicationsPage({ user, isGuest, onRequireLogin }) {
  const [apps, setApps] = useState(null);
  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    loadMyApplications(uid)
      .then(list => { if (!cancelled) setApps(list); })
      .catch(e => { console.error("[my-apps] load failed:", e); if (!cancelled) setApps([]); });
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <div className="tj-scroll">
      <div className="tj-wrap" style={{ maxWidth: 760 }}>
        <JobsStyles />
        <Helmet><title>My applications | TIN Jobs</title><meta name="robots" content="noindex" /></Helmet>
        <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
          <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / My applications
        </div>
        <h1 style={{ ...heading, fontSize: 26, margin: "0 0 4px" }}>My applications <span lang="hi" style={{ fontSize: 18, color: "var(--t3)" }}>· मेरे आवेदन</span></h1>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <Link to="/jobs/profile" style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>My job profile →</Link>
          <Link to="/jobs/saved" style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)", textDecoration: "none" }}>★ Saved jobs →</Link>
        </div>
        {isGuest || !uid ? (
          <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 10 }}>Log in to see your applications</div>
            <button onClick={onRequireLogin} style={btnPrimary}>Log in</button>
          </div>
        ) : apps === null ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Loading…</div>
        ) : apps.length === 0 ? (
          <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No applications yet</div>
            <div style={{ fontSize: 13, color: "var(--t3)" }}>Find a job and tap Apply. Every update from the employer shows here.</div>
            <Link to="/jobs" style={{ ...btnPrimary, display: "inline-block", marginTop: 12, textDecoration: "none" }}>Browse jobs</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {apps.map(a => <ApplicationItem key={a.id} app={a} uid={uid} />)}
          </div>
        )}
      </div>
    </div>
  );
}
