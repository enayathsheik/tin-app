import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { JOB_CATEGORIES, JOB_TYPES, CITIES } from "../../data/constants";

export function PostJobModal({ user, isGuest = false, onRequireLogin = () => {}, onPosted, toast }) {
  const [showPost, setShowPost] = useState(false);
  const [postForm, setPostForm] = useState({
    jobTitle: "", category: "", businessName: "", description: "", city: "",
    jobType: "", salaryRange: "", contactPhone: "", notAgencyDeclaration: false,
  });
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postSubmitted, setPostSubmitted] = useState(null); // null | "approved" | "pending"
  const [postError, setPostError] = useState("");

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
      const docRef = await addDoc(collection(db, "jobListings"), {
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
        // jobStatus tracks live/filled/closed independent of moderation status,
        // and only makes sense once the listing is actually approved/visible.
        ...(status === "approved" ? { jobStatus: "live" } : {}),
        createdAt: serverTimestamp(),
      });
      setPostSubmitted(status);
      setPostSubmitting(false);
      if (status === "approved" && toast) toast("Job posted! It's now live.", "ok");
      setTimeout(() => { closePost(); onPosted?.(docRef.id, status); }, 2500);
    } catch (e) {
      console.error("[jobs] Post failed:", e);
      setPostError("Could not post job: " + e.message);
      setPostSubmitting(false);
    }
  };

  return (
    <>
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
    </>
  );
}
