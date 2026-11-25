// "Shortlist for job…" (A3): pick one of your live jobs → phone, email and CV
// unlock straight away, one of that job's shortlists is used, and the person
// is in that job's pipeline. All checks are in the shortlistCandidate function.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadMyLiveJobs, shortlistFromSearch } from "../../../lib/findCandidates";
import { loadApplicationContact, openApplicationCv } from "../../../lib/applications";
import { messageAboutApplication } from "../../../lib/jobMessages";
import { SHORTLIST_FULL_MESSAGE, isShortlistFull } from "../../../utils/shortlist.js";
import { useShortlistLimit } from "../../../hooks/useShortlistLimit";

const btn = { minHeight: 44, padding: "0 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const primary = { ...btn, background: "#e85a2a", color: "#fff", border: "none" };
const outline = { ...btn, background: "transparent", color: "var(--t1)", border: "1px solid var(--b3)", display: "inline-flex", alignItems: "center", textDecoration: "none" };
const warn = { fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" };

export function ShortlistForJob({ person, user, jobs, onShortlisted, onOpenJob }) {
  const navigate = useNavigate();
  const limit = useShortlistLimit();
  const [live, setLive] = useState(null); // null = loading
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState({ code: "", text: "" });
  const [done, setDone] = useState(null); // { app, contact, status, leftToday }

  useEffect(() => {
    let cancelled = false;
    loadMyLiveJobs(user.uid).then(list => {
      if (cancelled) return;
      setLive(list);
      if (list.length === 1) setJobId(list[0].id);
    }).catch(e => {
      console.error("[find-candidates] live jobs failed:", e);
      if (!cancelled) { setLive([]); setError({ code: "load", text: "Couldn't load your jobs. Please close this and try again." }); }
    });
    return () => { cancelled = true; };
  }, [user.uid]);

  const job = live?.find(j => j.id === jobId) || null;
  const postButton = <button type="button" onClick={() => navigate("/jobs/post")} style={{ ...primary, marginTop: 10 }}>+ Post a Job</button>;

  const go = async () => {
    setBusy(true); setError({ code: "", text: "" });
    try {
      const r = await shortlistFromSearch(jobId, person.uid);
      const app = { id: r.applicationId, jobId, applicantUid: person.uid, applicantName: person.name || "", stage: "shortlisted", contactUnlockedAt: true };
      onShortlisted(jobId, r);
      setDone({ app, contact: await loadApplicationContact(app), status: r.status, leftToday: r.leftToday });
    } catch (e) {
      setError({ code: e.code || "", text: e.message });
      // The job filled up (or changed) meanwhile: show its current state.
      if (e.code === "shortlist_full") setLive(ls => ls.map(j => (j.id === jobId ? { ...j, shortlistCount: limit } : j)));
      if (e.code === "job_not_live") { setLive(ls => ls.filter(j => j.id !== jobId)); setJobId(""); }
    }
    setBusy(false);
  };

  if (done) {
    const { app, contact } = done;
    const cv = async () => {
      const win = window.open("", "_blank");
      try { await openApplicationCv({ ...app, ...contact }, win); } catch (e) { if (win) win.close(); setError({ code: "cv", text: "Couldn't open the CV: " + (e.message || e) }); }
    };
    const chat = async () => {
      setBusy(true);
      try { navigate(`/conversations/${await messageAboutApplication({ myUid: user.uid, myName: job?.businessName || user.name || "", otherUid: person.uid, otherName: person.name || "", app })}`); }
      catch (e) { console.error("[find-candidates] message failed:", e); setError({ code: "msg", text: "Couldn't open messages. Please try again." }); setBusy(false); }
    };
    return (
      <div>
        <div role="status" style={{ fontSize: 14, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
          ✓ {done.status === "already" ? `You had already shortlisted ${person.name || "this person"} for ${job?.title || "this job"}. No extra shortlist was used.` : `${person.name || "This person"} is shortlisted for ${job?.title || "your job"}.`}
        </div>
        {contact ? (
          <div style={{ marginTop: 12, fontSize: 15, color: "var(--t1)", display: "grid", gap: 4 }}>
            {contact.applicantPhone && <b>{contact.applicantPhone}</b>}
            {contact.applicantEmail && <a href={`mailto:${contact.applicantEmail}`} style={{ color: "var(--t1)" }}>{contact.applicantEmail}</a>}
          </div>
        ) : <div style={{ ...warn, marginTop: 12 }}>Their contact details are in the job’s pipeline.</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {contact?.applicantPhone && <a href={`tel:${contact.applicantPhone}`} style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>📞 Call</a>}
          <button type="button" disabled={busy} onClick={chat} style={outline}>💬 Message</button>
          {contact?.resumePath && <button type="button" onClick={cv} style={outline}>📄 CV</button>}
          <button type="button" onClick={() => onOpenJob(app.jobId)} style={outline}>Open in pipeline →</button>
        </div>
        {error.text && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 10 }}>⚠ {error.text}</div>}
        {typeof done.leftToday === "number" && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 12 }}>{done.leftToday} search {done.leftToday === 1 ? "shortlist" : "shortlists"} left today.</div>}
      </div>
    );
  }

  if (live === null) return <div style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Loading your jobs…</div>;
  if (live.length === 0) {
    if (error.code === "load") return <div role="alert" style={{ fontSize: 13, color: "#b91c1c" }}>⚠ {error.text}</div>;
    const waiting = jobs.some(j => j.status === "pending");
    const paused = jobs.some(j => j.status === "approved" && j.jobStatus === "paused");
    return (
      <div style={warn}>
        {error.text || "You need a live job to shortlist someone."}{" "}
        {waiting ? "Your job is waiting for TIN’s review. Once it’s live, you can shortlist people for it." : paused ? "Reopen a paused job from your Desk, or post a new one." : "Post a job first. It’s reviewed, then you can shortlist people for it."}
        <div>{postButton}</div>
      </div>
    );
  }
  const full = job && isShortlistFull(job, limit);
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 8 }}>Which job is this for?</div>
      <div role="radiogroup" aria-label="Job" style={{ display: "grid", gap: 8 }}>
        {live.map(j => {
          const on = j.id === jobId;
          return (
            <button key={j.id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => { setJobId(j.id); setError({ code: "", text: "" }); }}
              style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", border: `2px solid ${on ? "var(--acc)" : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{on ? "✓ " : ""}{j.title}</div>
              <div style={{ fontSize: 12, color: isShortlistFull(j, limit) ? "#b45309" : "var(--t3)" }}>{[j.city, `Shortlisted ${Math.min(j.shortlistCount, limit)} of ${limit}`].filter(Boolean).join(" · ")}</div>
            </button>
          );
        })}
      </div>
      {error.text && error.code !== "shortlist_full" && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginTop: 10 }}>⚠ {error.text}</div>}
      {full ? (
        <div role="status" style={{ ...warn, marginTop: 12 }}>{SHORTLIST_FULL_MESSAGE(limit)}<div>{postButton}</div></div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--t3)", margin: "12px 0" }}>Uses 1 of this job’s shortlists and shows you their phone, email and CV straight away. They’ll see it in My applications. Use these details only for hiring for this job.</div>
          <button type="button" disabled={busy || !job} onClick={go} style={{ ...primary, width: "100%", opacity: job ? 1 : 0.5 }}>{busy ? "Shortlisting…" : "Shortlist and show contact"}</button>
        </>
      )}
    </div>
  );
}
