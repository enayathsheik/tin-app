import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { JOB_CATEGORIES, JOB_TYPES, CITIES } from "../data/constants";
import { PostJobModal } from "../components/shared/PostJobModal";
import { JobApplyModal } from "../components/shared/JobApplyModal";
import { useJobApply } from "../hooks/useJobApply";

export function JobsPage({ user, isGuest, onRequireLogin, toast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterCity, setFilterCity] = useState("");
  const [filterJobType, setFilterJobType] = useState("All");

  const applyState = useJobApply(user, isGuest, onRequireLogin);
  const { appliedJobIds, openApply } = applyState;

  const loadJobs = async () => {
    setLoading(true);
    try {
      // Public feed: only moderation-approved AND currently live listings.
      // Filled/closed listings stay visible to their poster (Retailer "My Jobs" view) but drop out here.
      const snap = await getDocs(query(
        collection(db, "jobListings"),
        where("status", "==", "approved"),
        where("jobStatus", "==", "live")
      ));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setJobs(all);
    } catch (e) {
      console.error("[jobs] Failed to load listings:", e);
      setJobs([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadJobs(); }, []);

  const filtered = jobs.filter(j => {
    const mCat = filterCategory === "All" || j.category === filterCategory;
    const mCity = !filterCity.trim() || (j.city || "").toLowerCase().includes(filterCity.trim().toLowerCase());
    const mType = filterJobType === "All" || j.jobType === filterJobType;
    return mCat && mCity && mType;
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 100px", position: "relative", minHeight: "60vh" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 24, color: "var(--t1)" }}>Jobs</div>
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Hiring across building materials, construction, interiors & exteriors</div>
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <select className="fi" style={{ maxWidth: 240 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="fi" style={{ maxWidth: 200 }} list="jobs-cities-list" placeholder="Filter by city" value={filterCity} onChange={e => setFilterCity(e.target.value)} />
        <datalist id="jobs-cities-list">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
        <select className="fi" style={{ maxWidth: 180 }} value={filterJobType} onChange={e => setFilterJobType(e.target.value)}>
          <option value="All">All Job Types</option>
          {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💼</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No jobs found</div>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>{jobs.length === 0 ? "No listings yet — check back soon, or be the first to post one." : "Try adjusting your filters."}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map(j => {
            const isOwnListing = !isGuest && j.postedByUid === user?.uid;
            const alreadyApplied = appliedJobIds.has(j.id);
            return (
              <div key={j.id} style={{ background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 16, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <Link to={`/jobs/${j.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)", textDecoration: "none" }}>{j.jobTitle}</Link>
                  {j.postedByType === "verified_business" && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>✓ Verified business</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>{j.businessName || j.postedByName || "Individual poster"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "2px 8px" }}>📍 {j.city}</span>
                  <span style={{ fontSize: 11, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "2px 8px" }}>{j.jobType}</span>
                  <span style={{ fontSize: 11, color: "var(--t2)", background: "var(--s2)", borderRadius: 10, padding: "2px 8px" }}>{j.category}</span>
                </div>
                {j.salaryRange && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--acc)", marginBottom: 8 }}>{j.salaryRange}</div>}
                <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 12, flex: 1 }}>{j.description}</div>
                {isOwnListing ? (
                  <button disabled style={{ padding: "8px 14px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 12, fontWeight: 700, cursor: "default" }}>
                    This is your listing
                  </button>
                ) : alreadyApplied ? (
                  <button disabled style={{ padding: "8px 14px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--b2)", color: "var(--t3)", fontSize: 12, fontWeight: 700, cursor: "default" }}>
                    ✓ Applied
                  </button>
                ) : (
                  <button onClick={() => openApply(j)} style={{ padding: "8px 14px", borderRadius: 8, background: "#e85a2a", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Apply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PostJobModal user={user} isGuest={isGuest} onRequireLogin={onRequireLogin} onPosted={loadJobs} toast={toast} />

      <JobApplyModal {...applyState} />
    </div>
  );
}
