import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { JOB_CATEGORIES, JOB_TYPES, CITIES } from "../data/constants";

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

  const [showPost, setShowPost] = useState(false);
  const [postForm, setPostForm] = useState({
    jobTitle: "", category: "", businessName: "", description: "", city: "",
    jobType: "", salaryRange: "", contactPhone: "", notAgencyDeclaration: false,
  });
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postSubmitted, setPostSubmitted] = useState(null); // null | "approved" | "pending"
  const [postError, setPostError] = useState("");

  const loadJobs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "jobListings"), where("status", "==", "approved")));
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

  const openApply = (job) => {
    if (isGuest) { onRequireLogin(); return; }
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

      await addDoc(collection(db, "jobApplications"), {
        jobId: applyingJob.id,
        applicantUid: user.uid,
        applicantName: applyName.trim(),
        applicantPhone: applyPhone.trim(),
        message: applyMessage.trim(),
        resumeUrl,
        resumeFileName: applyResumeFile.name,
        createdAt: serverTimestamp(),
      });
      setApplySubmitted(true);
      setApplySubmitting(false);
      setTimeout(() => { closeApply(); }, 2500);
    } catch (e) {
      console.error("[jobs] Application failed:", e);
      setApplyError("Could not send application: " + e.message);
      setApplySubmitting(false);
    }
  };

  const openPost = () => {
    if (isGuest) { onRequireLogin(); return; }
    setPostForm({
      jobTitle: "", category: "", businessName: user?.company || user?.storeName || "",
      description: "", city: "", jobType: "", salaryRange: "",
      contactPhone: user?.phone || "", notAgencyDeclaration: false,
    });
    setPostError("");
    setPostSubmitted(null);
    setShowPost(true);
  };

  const closePost = () => { setShowPost(false); setPostSubmitted(null); };
  const updPost = (k, v) => setPostForm(f => ({ ...f, [k]: v }));

  const submitPost = async () => {
    const f = postForm;
    if (!f.jobTitle.trim() || !f.category || !f.description.trim() || !f.city.trim() || !f.jobType || !f.contactPhone.trim()) {
      setPostError("Please fill in all required fields."); return;
    }
    if (!f.notAgencyDeclaration) { setPostError("Please confirm this is not a recruitment/staffing agency listing."); return; }
    setPostSubmitting(true);
    setPostError("");
    try {
      const isVerifiedBusiness = user.verificationStatus === "verified";
      const status = isVerifiedBusiness ? "approved" : "pending";
      await addDoc(collection(db, "jobListings"), {
        postedByUid: user.uid,
        postedByName: user.name || "",
        postedByType: isVerifiedBusiness ? "verified_business" : "individual",
        businessName: f.businessName.trim(),
        jobTitle: f.jobTitle.trim(),
        category: f.category,
        description: f.description.trim(),
        city: f.city.trim(),
        jobType: f.jobType,
        salaryRange: f.salaryRange.trim(),
        contactPhone: f.contactPhone.trim(),
        notAgencyDeclaration: true,
        status,
        createdAt: serverTimestamp(),
      });
      setPostSubmitted(status);
      setPostSubmitting(false);
      if (status === "approved" && toast) toast("Job posted! It's now live.", "ok");
      setTimeout(() => { closePost(); if (status === "approved") loadJobs(); }, 2500);
    } catch (e) {
      console.error("[jobs] Post failed:", e);
      setPostError("Could not post job: " + e.message);
      setPostSubmitting(false);
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
          {filtered.map(j => (
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
              <button onClick={() => openApply(j)} style={{ padding: "8px 14px", borderRadius: 8, background: "#e85a2a", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Apply</button>
            </div>
          ))}
        </div>
      )}

      {/* FLOATING POST BUTTON */}
      <button
        onClick={openPost}
        style={{
          position: "fixed", bottom: 90, right: 24, padding: "0 20px", height: 48, borderRadius: 24,
          background: "var(--acc)", color: "white", border: "none", fontSize: 14, fontWeight: 700,
          boxShadow: "0 4px 14px rgba(0,0,0,.25)", cursor: "pointer", zIndex: 200,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        + Post a Job
      </button>

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

      {/* POST A JOB MODAL */}
      {showPost && (
        <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closePost}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 460, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.15)", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            {postSubmitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#080808" }}>{postSubmitted === "approved" ? "Job posted!" : "Submitted for review"}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
                  {postSubmitted === "approved" ? "Your listing is live on the Jobs board." : "Your job will appear once reviewed by the TIN team."}
                </div>
              </div>
            ) : <>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 20, color: "#080808", marginBottom: 4 }}>Post a Job</div>
              <div style={{ fontSize: 12, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                {user?.verificationStatus === "verified"
                  ? "Verified businesses go live immediately."
                  : "Listings from unverified accounts are reviewed before going live."}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Job Title <span style={{color:"#e85a2a"}}>*</span></div>
                <input className="fi" placeholder="e.g. Interior Designer, Site Mason, 3D Visualizer" value={postForm.jobTitle} onChange={e => updPost("jobTitle", e.target.value)} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Category <span style={{color:"#e85a2a"}}>*</span></div>
                <select className="fi" value={postForm.category} onChange={e => updPost("category", e.target.value)}>
                  <option value="">Select a category</option>
                  {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Business / Company Name (optional)</div>
                <input className="fi" placeholder="Company or store name" value={postForm.businessName} onChange={e => updPost("businessName", e.target.value)} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Description <span style={{color:"#e85a2a"}}>*</span></div>
                <textarea className="fta" rows={3} placeholder="Role, responsibilities, requirements…" value={postForm.description} onChange={e => updPost("description", e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>City <span style={{color:"#e85a2a"}}>*</span></div>
                  <input className="fi" list="jobs-post-cities-list" placeholder="City" value={postForm.city} onChange={e => updPost("city", e.target.value)} />
                  <datalist id="jobs-post-cities-list">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Job Type <span style={{color:"#e85a2a"}}>*</span></div>
                  <select className="fi" value={postForm.jobType} onChange={e => updPost("jobType", e.target.value)}>
                    <option value="">Select</option>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Salary Range (optional)</div>
                <input className="fi" placeholder="e.g. ₹25,000 – ₹35,000/month" value={postForm.salaryRange} onChange={e => updPost("salaryRange", e.target.value)} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Contact Phone <span style={{color:"#e85a2a"}}>*</span></div>
                <input className="fi" placeholder="Your mobile number" value={postForm.contactPhone} onChange={e => updPost("contactPhone", e.target.value)} />
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, fontSize: 12, color: "#555", cursor: "pointer" }}>
                <input type="checkbox" checked={postForm.notAgencyDeclaration} onChange={e => updPost("notAgencyDeclaration", e.target.checked)} style={{ marginTop: 2 }} />
                <span>I confirm this is a direct hiring listing and I am not a recruitment/staffing agency. <span style={{color:"#e85a2a"}}>*</span></span>
              </label>

              {postError && (
                <div style={{ fontSize: 12, color: "#dc2626", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                  ⚠ {postError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submitPost} disabled={postSubmitting}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, background: postSubmitting ? "#f5f5f5" : "#e85a2a", border: "none", color: postSubmitting ? "#888" : "white", fontSize: 13, fontWeight: 700, cursor: postSubmitting ? "default" : "pointer" }}>
                  {postSubmitting ? "Posting…" : "Post Job"}
                </button>
                <button onClick={closePost} style={{ padding: "9px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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
