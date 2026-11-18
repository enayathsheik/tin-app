import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStoreOpenJobs } from "../../lib/jobsPost";
import { LANE_COLOR, chip, payLine } from "./jobsStyle";

// "Open jobs" on a store profile: live jobs whose storeId is this store.
// Only an account the admin has linked to this store can put its id on a
// job (enforced in firestore.rules), so nobody can post onto someone
// else's store page. Renders nothing when there are no open jobs.
export function StoreOpenJobs({ storeId, storeName }) {
  const [result, setResult] = useState({ storeId: null, jobs: [] });

  useEffect(() => {
    let cancelled = false;
    fetchStoreOpenJobs(storeId)
      .then(jobs => { if (!cancelled) setResult({ storeId, jobs }); })
      .catch(e => { console.error("[store-jobs] Failed to load open jobs:", e); if (!cancelled) setResult({ storeId, jobs: [] }); });
    return () => { cancelled = true; };
  }, [storeId]);

  const jobs = result.storeId === storeId ? result.jobs : [];
  if (!jobs.length) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 20, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
        Open jobs at {storeName} · {jobs.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {jobs.map(j => {
          const lane = j.isNeededNow ? "needed-now" : j.lane;
          return (
            <Link key={j.id} to={`/jobs/${j.id}`} style={{ display: "block", textDecoration: "none", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e0", borderLeft: `3px solid ${LANE_COLOR[lane]}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#080808" }}>{j.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                {j.city && <span style={chip}>📍 {j.city}</span>}
                {[...j.workTypeLabels, ...(j.legacyJobType ? [j.legacyJobType] : [])].slice(0, 2).map(t => <span key={t} style={chip}>{t}</span>)}
                {j.headcount > 1 && <span style={chip}>{j.headcount} people</span>}
              </div>
              {payLine(j) && <div style={{ fontSize: 13, fontWeight: 700, color: "#e85a2a" }}>{payLine(j)}</div>}
            </Link>
          );
        })}
      </div>
      <Link to="/jobs" style={{ display: "inline-block", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#e85a2a", textDecoration: "none" }}>See all jobs on TIN →</Link>
    </div>
  );
}
