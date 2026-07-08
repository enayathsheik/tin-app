import { useState, useEffect } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase/config";

export function JobsReviewSection() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pendingSnap, approvedSnap] = await Promise.all([
        getDocs(query(collection(db, "jobListings"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "jobListings"), where("status", "==", "approved"))),
      ]);
      const byNewest = (a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0);
      setPending(pendingSnap.docs.sort(byNewest).map(d => ({ id: d.id, ...d.data() })));
      setApproved(approvedSnap.docs.sort(byNewest).map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log("Jobs load error:", e); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleApprove = async (job) => {
    setBusyId(job.id);
    try {
      await updateDoc(doc(db, "jobListings", job.id), { status: "approved" });
      setPending(p => p.filter(x => x.id !== job.id));
      setApproved(a => [...a, { ...job, status: "approved" }]);
    } catch (e) { alert("Approve failed: " + e.message); }
    setBusyId(null);
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await updateDoc(doc(db, "jobListings", id), { status: "rejected" });
      setPending(p => p.filter(x => x.id !== id));
    } catch (e) { alert("Reject failed: " + e.message); }
    setBusyId(null);
  };

  if (loading) return <div style={{ padding: 24, color: "var(--t3)" }}>Loading…</div>;

  const Card = ({ j, showActions }) => (
    <div key={j.id} style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{j.jobTitle}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: j.postedByType === "verified_business" ? "#16a34a" : "#888" }}>
          {j.postedByType === "verified_business" ? "✓ Verified business" : "Individual"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{j.businessName || j.postedByName} · {j.city} · {j.jobType} · {j.category}</div>
      {j.salaryRange && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--acc)", marginTop: 4 }}>{j.salaryRange}</div>}
      <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 6 }}>{j.description}</div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>Contact: {j.contactPhone}</div>
      <div style={{ fontSize: 11, marginTop: 6, color: j.notAgencyDeclaration ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
        {j.notAgencyDeclaration ? "✓ Confirmed not an agency" : "⚠ Agency declaration missing"}
      </div>
      {showActions && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button className="btn-sm btn-ok" disabled={busyId === j.id} onClick={() => handleApprove(j)}>✓ Approve</button>
          <button className="btn-sm" style={{ background: "var(--danger)15", color: "var(--danger)", border: "1px solid var(--danger)25", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }} disabled={busyId === j.id} onClick={() => handleReject(j.id)}>✕ Reject</button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="admin-hd">
        <div className="admin-title">Jobs Review</div>
        <div className="admin-sub">Approve or reject job listings from unverified accounts</div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 10 }}>
        Pending Review ({pending.length})
      </div>
      {pending.length === 0 ? (
        <div className="val-ok-banner" style={{ marginBottom: 24 }}><span>✓</span><div>No pending job listings.</div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 28 }}>
          {pending.map(j => <Card key={j.id} j={j} showActions />)}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 10 }}>
        Approved Listings ({approved.length})
      </div>
      {approved.length === 0 ? (
        <div style={{ padding: 16, color: "var(--t3)", fontSize: 13 }}>No approved listings yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {approved.map(j => <Card key={j.id} j={j} showActions={false} />)}
        </div>
      )}
    </div>
  );
}
