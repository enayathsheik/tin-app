import { useState, useEffect } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase/config";

export function InspiReviewSection() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pendingSnap, approvedSnap] = await Promise.all([
        getDocs(query(collection(db, "inspiPosts"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "inspiPosts"), where("status", "==", "approved"))),
      ]);
      const byNewest = (a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0);
      setPending(pendingSnap.docs.sort(byNewest).map(d => ({ id: d.id, ...d.data() })));
      setApproved(approvedSnap.docs.sort(byNewest).map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log("Inspi load error:", e); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleApprove = async (post) => {
    setBusyId(post.id);
    try {
      await updateDoc(doc(db, "inspiPosts", post.id), { status: "approved" });
      setPending(p => p.filter(x => x.id !== post.id));
      setApproved(a => [...a, { ...post, status: "approved" }]);
    } catch (e) { alert("Approve failed: " + e.message); }
    setBusyId(null);
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "inspiPosts", id), { status: "rejected" });
      setPending(p => p.filter(x => x.id !== id));
    } catch (e) { alert("Reject failed: " + e.message); }
    setBusyId(null);
  };

  const toggleFeatured = async (post) => {
    setBusyId(post.id);
    try {
      await updateDoc(doc(db, "inspiPosts", post.id), { featured: !post.featured });
      setApproved(a => a.map(x => x.id === post.id ? { ...x, featured: !x.featured } : x));
    } catch (e) { alert("Feature toggle failed: " + e.message); }
    setBusyId(null);
  };

  const Media = ({ post, maxHeight = 140 }) => post.mediaType === "video"
    ? <video src={post.mediaUrl} controls muted style={{ width: "100%", maxHeight, objectFit: "cover", borderRadius: 8, background: "#000" }} />
    : <img src={post.mediaUrl} alt={post.caption || "Inspi"} style={{ width: "100%", maxHeight, objectFit: "cover", borderRadius: 8 }} />;

  if (loading) return <div style={{ padding: 24, color: "var(--t3)" }}>Loading…</div>;

  return (
    <div>
      <div className="admin-hd">
        <div className="admin-title">Inspi Review</div>
        <div className="admin-sub">Approve, reject, or feature community inspiration posts</div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 10 }}>
        Pending Review ({pending.length})
      </div>
      {pending.length === 0 ? (
        <div className="val-ok-banner" style={{ marginBottom: 24 }}><span>✓</span><div>No pending Inspi posts.</div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
          {pending.map(p => (
            <div key={p.id} style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 12 }}>
              <Media post={p} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginTop: 8 }}>{p.uploaderName || "Unknown"}</div>
              {p.caption && <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{p.caption}</div>}
              {p.category && <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 }}>{p.category}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn-sm btn-ok" disabled={busyId === p.id} onClick={() => handleApprove(p)}>✓ Approve</button>
                <button className="btn-sm" style={{ background: "var(--danger)15", color: "var(--danger)", border: "1px solid var(--danger)25", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }} disabled={busyId === p.id} onClick={() => handleReject(p.id)}>✕ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 10 }}>
        Approved Posts ({approved.length})
      </div>
      {approved.length === 0 ? (
        <div style={{ padding: 16, color: "var(--t3)", fontSize: 13 }}>No approved posts yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {approved.map(p => (
            <div key={p.id} style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 12, position: "relative" }}>
              {p.featured && <div style={{ position: "absolute", top: 18, left: 18, background: "var(--acc)", color: "white", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10 }}>★ Featured</div>}
              <Media post={p} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginTop: 8 }}>{p.uploaderName || "Unknown"}</div>
              {p.caption && <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{p.caption}</div>}
              <button className="btn-sm btn-out" disabled={busyId === p.id} onClick={() => toggleFeatured(p)} style={{ marginTop: 10 }}>
                {p.featured ? "☆ Unfeature" : "★ Feature"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
