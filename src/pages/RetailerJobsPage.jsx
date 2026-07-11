import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { PostJobModal } from "../components/shared/PostJobModal";

const JOB_STATUS_OPTIONS = [["live", "Live"], ["filled", "Filled"], ["closed", "Closed"]];
const APPLICANT_STATUS_OPTIONS = [["new", "New"], ["shortlisted", "Shortlisted"], ["rejected", "Rejected"], ["hired", "Hired"]];

export function RetailerJobsPage({ user }) {
  const [myJobs, setMyJobs] = useState(null); // null = loading
  const [applicantsByJob, setApplicantsByJob] = useState({});

  const load = async () => {
    if (!user?.uid) { setMyJobs([]); return; }
    try {
      const snap = await getDocs(query(collection(db, "jobListings"), where("postedByUid", "==", user.uid)));
      const listings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      listings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyJobs(listings);
      const entries = await Promise.all(listings.map(async (j) => {
        const appSnap = await getDocs(query(collection(db, "jobApplications"), where("jobId", "==", j.id)));
        const apps = appSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        apps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return [j.id, apps];
      }));
      setApplicantsByJob(Object.fromEntries(entries));
    } catch (e) {
      console.error("[retailer-jobs] Failed to load job posts:", e);
      setMyJobs([]);
    }
  };

  useEffect(() => { load(); }, [user?.uid]);

  const setJobStatus = async (jobId, jobStatus) => {
    const prev = myJobs;
    setMyJobs(js => js.map(j => j.id === jobId ? { ...j, jobStatus } : j));
    try {
      await updateDoc(doc(db, "jobListings", jobId), { jobStatus, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("[retailer-jobs] Failed to update job status:", e);
      alert("Could not update job status: " + e.message);
      setMyJobs(prev);
    }
  };

  const setApplicantStatus = async (jobId, appId, applicantStatus) => {
    const prev = applicantsByJob;
    setApplicantsByJob(m => ({
      ...m,
      [jobId]: (m[jobId] || []).map(a => a.id === appId ? { ...a, applicantStatus } : a),
    }));
    try {
      await updateDoc(doc(db, "jobApplications", appId), { applicantStatus });
    } catch (e) {
      console.error("[retailer-jobs] Failed to update applicant status:", e);
      alert("Could not update applicant status: " + e.message);
      setApplicantsByJob(prev);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 100px", position: "relative", minHeight: "60vh" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 24, color: "var(--t1)" }}>My Jobs</div>
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Manage your job listings and review applicants</div>
      </div>

      {myJobs === null ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>Loading…</div>
      ) : myJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💼</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No jobs posted yet</div>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Tap "+ Post a Job" to hire for your business.</div>
        </div>
      ) : (
        myJobs.map(j => {
          const applicants = applicantsByJob[j.id] || [];
          const statusColor = j.status === "approved" ? "#16a34a" : j.status === "rejected" ? "#dc2626" : "#d97706";
          const statusBg = j.status === "approved" ? "#f0fdf4" : j.status === "rejected" ? "#fff0f0" : "#fffbeb";
          const jobStatus = j.jobStatus || "live";
          return (
            <div key={j.id} style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{j.jobTitle}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, border: `1px solid ${statusColor}30`, borderRadius: 10, padding: "2px 8px", textTransform: "capitalize", whiteSpace: "nowrap" }}>{j.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>{j.city} · {j.jobType} · {j.category}</div>

              {j.status === "approved" ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {JOB_STATUS_OPTIONS.map(([val, label]) => {
                    const active = jobStatus === val;
                    return (
                      <button key={val} onClick={() => setJobStatus(j.id, val)}
                        style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: active ? "1px solid var(--acc)" : "1px solid var(--b2)",
                          background: active ? "var(--acc)18" : "var(--s2)",
                          color: active ? "var(--acc)" : "var(--t3)",
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>
                  {j.status === "pending" ? "Live/Filled/Closed status is available once this listing is approved." : "This listing was rejected."}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: applicants.length ? 6 : 0 }}>
                {applicants.length} applicant{applicants.length === 1 ? "" : "s"}
              </div>
              {applicants.map(a => (
                <div key={a.id} style={{ background: "var(--s2)", borderRadius: 8, padding: "10px 12px", marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{a.applicantName} · {a.applicantPhone}</div>
                    <select value={a.applicantStatus || "new"} onChange={e => setApplicantStatus(j.id, a.id, e.target.value)}
                      style={{ fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t1)", cursor: "pointer" }}>
                      {APPLICANT_STATUS_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </div>
                  {a.message && <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>{a.message}</div>}
                  {a.resumeUrl && (
                    <a href={a.resumeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#1D4ED8", textDecoration: "none", marginTop: 4 }}>
                      📄 View Resume{a.resumeFileName ? ` (${a.resumeFileName})` : ""}
                    </a>
                  )}
                </div>
              ))}
            </div>
          );
        })
      )}

      <PostJobModal user={user} onPosted={load} />
    </div>
  );
}
