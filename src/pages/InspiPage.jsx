import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

const CATEGORIES = ["Interior", "Exterior", "Kitchen", "Bathroom", "Lighting", "Furniture", "Landscaping", "Other"];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 720;
const MAX_VIDEO_SECONDS = 30;

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image — file may be corrupted.")); };
    img.src = url;
  });
}

function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read video — file may be corrupted.")); };
    video.src = url;
  });
}

async function validateMedia(file, mediaType) {
  if (mediaType === "image") {
    if (file.size > MAX_IMAGE_BYTES) return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max 5MB.`;
    const { width, height } = await readImageDimensions(file);
    if (Math.min(width, height) < MIN_IMAGE_DIMENSION) return `Image is too small (${width}×${height}px) — shorter side must be at least ${MIN_IMAGE_DIMENSION}px.`;
    return null;
  }
  if (file.size > MAX_VIDEO_BYTES) return `Video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max 30MB.`;
  const duration = await readVideoDuration(file);
  if (duration > MAX_VIDEO_SECONDS + 2) return `Video is too long (${Math.round(duration)}s) — max ${MAX_VIDEO_SECONDS}s.`;
  return null;
}

export function InspiPage({ user, isGuest, onRequireLogin, toast }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "inspiPosts"), where("status", "==", "approved")));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => {
        if (!!b.featured !== !!a.featured) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
        const at = a.createdAt?.seconds || 0, bt = b.createdAt?.seconds || 0;
        return bt - at;
      });
      setPosts(all);
    } catch (e) {
      console.error("[inspi] Failed to load posts:", e);
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, []);

  const resetUploadForm = () => {
    setFile(null); setPreview(null); setMediaType(null);
    setCaption(""); setCategory(""); setValidationError(""); setSubmitted(false);
  };

  const openUpload = () => {
    if (isGuest) { onRequireLogin(); return; }
    resetUploadForm();
    setShowUpload(true);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const type = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
    if (!type) { setValidationError("Please choose an image or video file."); return; }
    setValidationError("");
    setFile(f);
    setMediaType(type);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file || !mediaType) { setValidationError("Please choose a file first."); return; }
    setSubmitting(true);
    setValidationError("");
    try {
      const err = await validateMedia(file, mediaType);
      if (err) { setValidationError(err); setSubmitting(false); return; }

      const path = `inspi/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const mediaUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "inspiPosts"), {
        uploaderUid: user.uid,
        uploaderName: user.name || "Anonymous",
        mediaUrl,
        mediaType,
        caption: caption.trim(),
        category: category || "",
        status: "pending",
        featured: false,
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => { setShowUpload(false); resetUploadForm(); }, 2500);
    } catch (e) {
      console.error("[inspi] Upload failed:", e);
      setValidationError("Upload failed: " + e.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 100px", position: "relative", minHeight: "60vh" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 24, color: "var(--t1)" }}>Inspi</div>
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Design inspiration from the TIN community</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>Loading…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: "var(--r)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🖼</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 4 }}>No inspiration posts yet</div>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Be the first to share something — every post is reviewed before it goes public.</div>
        </div>
      ) : (
        <div className="inspi-grid">
          {posts.map(p => (
            <div key={p.id} className="inspi-card" style={{ breakInside: "avoid", marginBottom: 12, borderRadius: "var(--r)", overflow: "hidden", background: "var(--s1)", border: "1px solid var(--b2)", position: "relative" }}>
              {p.featured && (
                <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2, background: "var(--acc)", color: "white", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10 }}>
                  ★ Featured
                </div>
              )}
              {p.mediaType === "video" ? (
                <video
                  src={p.mediaUrl}
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", display: "block" }}
                  onMouseEnter={e => e.currentTarget.play()}
                  onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  controls
                />
              ) : (
                <img src={p.mediaUrl} alt={p.caption || "Inspiration"} style={{ width: "100%", display: "block" }} loading="lazy" />
              )}
              {(p.caption || p.category) && (
                <div style={{ padding: "8px 10px" }}>
                  {p.caption && <div style={{ fontSize: 12, color: "var(--t1)", marginBottom: p.category ? 4 : 0 }}>{p.caption}</div>}
                  {p.category && <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{p.category}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FLOATING UPLOAD BUTTON */}
      <button
        onClick={openUpload}
        style={{
          position: "fixed", bottom: 90, right: 24, width: 56, height: 56, borderRadius: "50%",
          background: "var(--acc)", color: "white", border: "none", fontSize: 26, fontWeight: 700,
          boxShadow: "0 4px 14px rgba(0,0,0,.25)", cursor: "pointer", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-label="Upload inspiration"
      >
        +
      </button>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.15)", maxHeight: "85vh", overflowY: "auto" }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#080808" }}>Submitted</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>Your post will appear once reviewed by the TIN team.</div>
              </div>
            ) : <>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 20, color: "#080808", marginBottom: 4 }}>Share Inspiration</div>
              <div style={{ fontSize: 12, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                Every post is manually reviewed before it appears publicly.
              </div>

              <div style={{ marginBottom: 14 }}>
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ fontSize: 13 }} />
              </div>

              {preview && (
                <div style={{ marginBottom: 14, borderRadius: 8, overflow: "hidden", maxHeight: 240 }}>
                  {mediaType === "video"
                    ? <video src={preview} controls style={{ width: "100%", display: "block" }} />
                    : <img src={preview} alt="Preview" style={{ width: "100%", display: "block" }} />}
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Caption (optional)</div>
                <input className="fi" placeholder="Say something about this…" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Category (optional)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <span key={c} onClick={() => setCategory(category === c ? "" : c)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontWeight: 600,
                        background: category === c ? "var(--acc)" : "#f5f5f5", color: category === c ? "white" : "#555",
                        border: `1px solid ${category === c ? "var(--acc)" : "#e0e0e0"}` }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {validationError && (
                <div style={{ fontSize: 12, color: "#dc2626", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                  ⚠ {validationError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSubmit} disabled={!file || submitting}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, background: (!file || submitting) ? "#f5f5f5" : "#e85a2a", border: "none", color: (!file || submitting) ? "#888" : "white", fontSize: 13, fontWeight: 700, cursor: (!file || submitting) ? "default" : "pointer" }}>
                  {submitting ? "Uploading…" : "Submit for Review"}
                </button>
                <button onClick={() => { setShowUpload(false); resetUploadForm(); }} style={{ padding: "9px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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
