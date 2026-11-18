import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchSavedJobs, SAVED_LIMIT } from "../lib/jobsFeed";
import { useJobApply } from "../hooks/useJobApply";
import { JobRow } from "../components/jobs/JobRow";
import { JobsStyles } from "../components/jobs/jobsUi";
import { btnPrimary, card, heading } from "../components/jobs/jobsStyle";
import { JobApplyModal } from "../components/shared/JobApplyModal";

// /jobs/saved — the signed-in user's saved jobs (users/{uid}/savedJobs,
// newest first, up to SAVED_LIMIT). The full "Saved jobs" tab in My TIN
// arrives with the candidate dashboard in Phase 4.
export function SavedJobsPage({ user, isGuest, onRequireLogin }) {
  const [jobs, setJobs] = useState(null); // null = loading
  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    fetchSavedJobs(user.uid)
      .then(list => { if (!cancelled) setJobs(list); })
      .catch(e => { console.error("[jobs] Failed to load saved jobs:", e); if (!cancelled) setJobs([]); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  return (
    <div className="tj-scroll">
    <div className="tj-wrap" style={{ maxWidth: 820 }}>
      <JobsStyles />
      <Helmet>
        <title>Saved jobs | TIN Jobs</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
        <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / Saved
      </div>
      <h1 style={{ ...heading, fontSize: 26, margin: "0 0 14px" }}>Saved jobs</h1>

      {isGuest || !user?.uid ? (
        <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 10 }}>Log in to see your saved jobs</div>
          <button onClick={onRequireLogin} style={btnPrimary}>Log in</button>
        </div>
      ) : jobs === null ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>☆</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No saved jobs yet</div>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Tap "Save job" on any listing to keep it here.</div>
        </div>
      ) : (
        <>
          <div className="tj-rows">
            {jobs.map(j => {
              const open = j.status === "approved" && j.jobStatus === "live";
              return (
                <div key={j.id} style={{ opacity: open ? 1 : 0.6 }}>
                  {!open && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 4 }}>No longer taking applications</div>}
                  <JobRow job={j}
                    isOwnListing={j.postedByUid === user.uid}
                    closed={!open}
                    alreadyApplied={appliedJobIds.has(j.id)}
                    onApply={openApply} />
                </div>
              );
            })}
          </div>
          {jobs.length >= SAVED_LIMIT && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 10 }}>Showing your {SAVED_LIMIT} most recently saved jobs.</div>}
        </>
      )}
      <JobApplyModal {...applyState} />
    </div>
    </div>
  );
}
