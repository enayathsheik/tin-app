import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { JOB_CATEGORIES, JOB_TYPES, CITIES } from "../data/constants";
import { PostJobModal } from "../components/shared/PostJobModal";

const RESUME_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const RESUME_MAX_BYTES = 5 * 1024 * 1024;

function validateResumeFile(f) {
  const name = f.name.toLowerCase();
  const validExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
  const validMime = RESUME_MIME_TYPES.includes(f.type);
  if (!validExt || !validMime) return "Please upload a PDF or Word document (.pdf, .doc, .docx).";
  if (f.size > RESUME_MAX_BYTES) return "Resume file must be under 5MB.";
  return null;
}

export function JobsPage({ user, isGuest, onRequireLogin, toast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterCity, setFilterCity] = useState("");
  const [filterJobType, setFilterJobType] = useState("All");

  const [applyingJob, setApplyingJob] = useState(null);
  const [applyName, setApplyName] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applyResumeFile, setApplyResumeFile] = useState(null);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [applyError, setApplyError] = useState("");

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

  const loadAppliedJobIds = async () => {
    if (!user?.uid) { setAppliedJobIds(new Set()); return; }
    try {
      const snap = await getDocs(query(collection(db, "jobApplications"), where("applicantUid", "==", user.uid)));
      setAppliedJobIds(new Set(snap.docs.map(d => d.data().jobId)));
    } catch (e) {
      console.error("[jobs] Failed to load applied jobs:", e);
    }
  };

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { loadAppliedJobIds(); }, [user?.uid]);

  const filtered = jobs.filter(j => {
    const mCat = filterCategory === "All" || j.category === filterCategory;
    const mCity = !filterCity.trim() || (j.city || "").toLowerCase().includes(filterCity.trim().toLowerCase());
    const mType = filterJobType === "All" || j.jobType === filterJobType;
    return mCat && mCity && mType;
  });

  const openApply = (job) => {
    if (isGuest) { onRequireLogin(); return; }
    if (job.postedByUid === user?.uid) return; // can't apply to your own listing
    if (appliedJobIds.has(job.id)) return; // already applied — no re-apply
    setApplyingJob(job);
    setApplyName(user?.name || "");
    setApplyPhone(user?.phone || "");
    setApplyMessage("");
    setApplyResumeFile(null);
    setApplyError("");
    setApplySubmitted(false);
  };

  const closeApply = () => { setApplyingJob(null); setApplySubmitted(false); setApplyResumeFile(null); };

  const handleResumeChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setApplyResumeFile(null); return; }
    const err = validateResumeFile(f);
    if (err) { setApplyError(err); setApplyResumeFile(null); e.target.value = ""; return; }
    setApplyError("");
    setApplyResumeFile(f);
  };

  const submitApplication = async () => {
    if (!applyName.trim() || !applyPhone.trim()) { setApplyError("Please enter your name and phone number."); return; }
    if (!applyResumeFile) { setApplyError("Please attach your resume (PDF or Word document)."); return; }
    const resumeErr = validateResumeFile(applyResumeFile);
    if (resumeErr) { setApplyError(resumeErr); return; }
    setApplySubmitting(true);
    setApplyError("");
    try {
      const path = `resumes/${user.uid}/${Date.now()}_${applyResumeFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, applyResumeFile);
      const resumeUrl = await getDownloadURL(storageRef);

      // Deterministic ID (jobId_applicantUid) — a second apply attempt targets the same
      // doc instead of creating a duplicate; firestore.rules also blocks resubmission.
      const appId = `${applyingJob.id}_${user.uid}`;
      await setDoc(doc(db, "jobApplications", appId), {
        jobId: applyingJob.id,
        applicantUid: user.uid,
        applicantName: applyName.trim(),
        applicantPhone: applyPhone.trim(),
        message: applyMessage.trim(),
        resumeUrl,
        resumeFileName: applyResumeFile.name,
        applicantStatus: "new",
        createdAt: serverTimestamp(),
      });
      setAppliedJobIds(ids => new Set(ids).add(applyingJob.id));
      setApplySubmitted(true);
      setApplySubmitting(false);
      setTimeout(() => { closeApply(); }, 2500);
    } catch (e) {
      console.error("[jobs] Application failed:", e);
      setApplyError("Could not send application: " + e.message);
      setApplySubmitting(false);
    }
  };

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
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>{j.jobTitle}</div>
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

      {/* APPLY MODAL */}
      {applyingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeApply}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.15)", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            {applySubmitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#080808" }}>Application sent</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>The poster will reach out to you directly.</div>
              </div>
            ) : <>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 20, color: "#080808", marginBottom: 4 }}>Apply — {applyingJob.jobTitle}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{applyingJob.businessName || applyingJob.postedByName} · {applyingJob.city}</div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Your Name</div>
                <input className="fi" placeholder="Full name" value={applyName} onChange={e => setApplyName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Phone Number</div>
                <input className="fi" placeholder="Your mobile number" value={applyPhone} onChange={e => setApplyPhone(e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Message (optional)</div>
                <textarea className="fta" rows={3} placeholder="A short note about why you're a good fit…" value={applyMessage} onChange={e => setApplyMessage(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Resume <span style={{color:"#e85a2a"}}>*</span></div>
                <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeChange} style={{ fontSize: 12, width: "100%" }} />
                {applyResumeFile && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>✓ {applyResumeFile.name}</div>}
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>PDF or Word document, max 5MB.</div>
              </div>

              {applyError && (
                <div style={{ fontSize: 12, color: "#dc2626", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                  ⚠ {applyError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submitApplication} disabled={applySubmitting}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, background: applySubmitting ? "#f5f5f5" : "#e85a2a", border: "none", color: applySubmitting ? "#888" : "white", fontSize: 13, fontWeight: 700, cursor: applySubmitting ? "default" : "pointer" }}>
                  {applySubmitting ? "Uploading…" : "Send Application"}
                </button>
                <button onClick={closeApply} style={{ padding: "9px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
