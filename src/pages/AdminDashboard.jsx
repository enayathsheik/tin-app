import { useState } from "react";
import { updateDoc, doc, serverTimestamp, getDoc, getDocs, query, collection, where, increment, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { BulkUploadPanel } from "../components/admin/BulkUploadPanel";
import { UserManagementSection } from "../components/admin/UserManagementSection";

export function AdminDashboard({ stores, contributors }) {
  const handleVerify = async (storeId) => {
    try {
      await updateDoc(doc(db, "stores", storeId), { verificationStatus: "verified", verifiedAt: serverTimestamp(), verifiedBy: "admin" });
      // Auto-credit 50 referral points if this store's contributor was referred by someone
      try {
        const storeSnap = await getDoc(doc(db, "stores", storeId));
        const contributorId = storeSnap.data()?.contributorId;
        if (contributorId) {
          const userSnap = await getDoc(doc(db, "users", contributorId));
          const referredBy = userSnap.data()?.referredBy;
          if (referredBy) {
            const refSnap = await getDocs(query(collection(db, "users"), where("referralCode", "==", referredBy)));
            if (!refSnap.empty) {
              const referrerUid = refSnap.docs[0].id;
              await updateDoc(doc(db, "users", referrerUid), { points: increment(50) });
              await addDoc(collection(db, "notifications", referrerUid, "items"), {
                type: "referral_credited",
                message: "You earned 50 points! Your referral was validated as a Market Champion.",
                read: false,
                createdAt: serverTimestamp()
              });
              alert("Approved! 50 referral points credited to referrer.");
              return;
            }
          }
        }
      } catch(refErr) { console.log("Referral credit error:", refErr); }
      alert("Store verified!");
    } catch(e) { alert("Error: " + e.message); }
  };
  const handleReject = async (storeId) => {
    try {
      await updateDoc(doc(db, "stores", storeId), { verificationStatus: "rejected" });
      alert("Store rejected.");
    } catch(e) { alert("Error: " + e.message); }
  };
  const [section, setSection] = useState("dashboard");
  const [uploadType, setUploadType] = useState("stores");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState([]);
  const [dupAction, setDupAction] = useState({});

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map((line, i) => {
      const vals = line.split(",").map(v => v.trim());
      return headers.reduce((obj, h, j) => ({ ...obj, [h]: vals[j] || "" }), { _row: i + 1 });
    });
  };

  const handleCSV = (text) => { setCsvText(text); setPreview(parseCSV(text)); };

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "validation", icon: "✅", label: "Market Champion Validation" },

    { id: "duplicates", icon: "🔗", label: "Duplicate Manager" },
    { id: "enrichment", icon: "✨", label: "Enrichment Queue" },
    { id: "reports", icon: "⚑", label: "Reports" },
    { id: "claims", icon: "🏷", label: "Business Claims" },
    { id: "suggestions", icon: "✏️", label: "Suggest Edits" },
    { id: "users", icon: "👥", label: "User Management" },
    { id: "records", icon: "🗂", label: "All Records" },
    { id: "bulk", icon: "📤", label: "Bulk Upload" },
  ];
  const pendingContribs = contributors.filter(c=>c.validationStatus==="pending");

  return (
    <div className="admin-pg">
      <div className="admin-nav">
        <div className="admin-nav-title">Admin Panel</div>
        {navItems.map(n => (
          <div key={n.id} className={`anav ${section === n.id ? "on" : ""}`} onClick={() => setSection(n.id)}>
            <span className="anav-icon">{n.icon}</span>{n.label}
          </div>
        ))}
      </div>
      <div className="admin-main">

        {section === "dashboard" && <>
          <div className="admin-hd">
            <div className="admin-title">Dashboard</div>
            <div className="admin-sub">Platform overview — Trade Interface Network</div>
          </div>
          <div className="admin-stats">
            {(() => {
              const pendingCount = stores.filter(s => s.verificationStatus !== "verified").length;
              const citiesCount = new Set(stores.map(s => s.city).filter(Boolean)).size;
              return [
                [stores.length.toLocaleString(),"Total Records","Live data"],
                [pendingContribs.length,"Pending Validation","Needs attention"],
                [citiesCount,"Cities Covered","Active cities"],
                [pendingCount,"Unverified Stores","Needs review"],
              ].map(([v, l, d]) => (
                <div key={l} className="as-card"><div className="as-val">{v}</div><div className="as-lbl">{l}</div><div className="as-delta">{d}</div></div>
              ));
            })()}
          </div>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <div className="table-hd"><span className="table-title">Recent Contributions</span><span style={{ fontSize: 12, color: "var(--t3)" }}>Last 24 hours</span></div>
            <table>
              <thead><tr><th>Store / Name</th><th>City</th><th>Category</th><th>Market Champion</th><th>Status</th><th>Confidence</th><th>Action</th></tr></thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--t1)", fontWeight: 500 }}>{s.storeName}</td>
                    <td>{s.city}</td>
                    <td>{s.category}</td>
                    <td>{s.contributorId}</td>
                    <td><span className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>{s.verificationStatus === "verified" ? "Verified" : "Community"}</span></td>
                    <td><span style={{ color: s.confidence >= 80 ? "var(--ok)" : s.confidence >= 50 ? "var(--warn)" : "#ef4444", fontWeight: 700 }}>{s.confidence}%</span></td>
                    <td style={{display:"flex",gap:4}}>
                      {s.verificationStatus !== "verified" && <button className="btn-sm btn-ok" onClick={()=>handleVerify(s.id)}>✓ Verify</button>}
                      {s.verificationStatus === "verified" && <button className="btn-sm btn-out" onClick={()=>handleReject(s.id)}>✕ Unverify</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {section === "validation" && <>
          <div className="admin-hd"><div className="admin-title">Market Champion Validation</div><div className="admin-sub">Review and approve Market Champion applications</div></div>
          {pendingContribs.length===0?(
            <div className="val-ok-banner"><span>✓</span><div>No pending validations. All contributors are approved.</div></div>
          ):pendingContribs.map(c=>(
            <div key={c.id} style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:16,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,var(--info),#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,color:"white"}}>{c.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:16}}>{c.name}</div>
                  <div style={{fontSize:12,color:"#080808"}}>{c.workEmail}</div>
                </div>
                <span className="badge bd">Pending Review</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[["Work Email",c.workEmail],["Personal Email",c.personalEmail],["Company",c.company],["LinkedIn",c.linkedin||"Not provided"]].map(([l,v])=>(
                  <div key={l} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:10}}>
                    <div style={{fontSize:10,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-sm btn-ok">✓ Approve</button>
                <button className="btn-sm btn-out">View LinkedIn ↗</button>
                <button className="btn-sm" style={{background:"var(--danger)15",color:"var(--danger)",border:"1px solid var(--danger)25",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>✕ Reject</button>
              </div>
            </div>
          ))}
        </>}

        {section === "bulk" && <>
          <div className="admin-hd">
            <div className="admin-title">Bulk Upload</div>
            <div className="admin-sub">Upload stores, contractors or architects from CSV</div>
          </div>
          <BulkUploadPanel />
        </>}

        {section === "users" && <UserManagementSection />}

        {section === "records" && <>
          <div className="admin-hd">
            <div className="admin-title">All Records</div>
            <div className="admin-sub">Complete database — stores, individuals, and professionals</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>City</th><th>Category</th><th>Business Type</th><th>Status</th><th>Confidence</th></tr></thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--t1)", fontWeight: 600 }}>{s.storeName}</td>
                    <td><span className="badge bp">{s.type === "individual" ? "Individual" : "Store"}</span></td>
                    <td>{s.city}</td>
                    <td>{s.category}</td>
                    <td>{s.businessType}</td>
                    <td><span className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>{s.verificationStatus === "verified" ? "Verified" : "Community"}</span></td>
                    <td><span style={{ color: s.confidence >= 80 ? "var(--ok)" : s.confidence >= 50 ? "var(--warn)" : "#ef4444", fontWeight: 700 }}>{s.confidence}%</span></td>
                    <td style={{display:"flex",gap:4}}>
                      {s.verificationStatus !== "verified" && <button className="btn-sm btn-ok" onClick={()=>handleVerify(s.id)}>✓ Verify</button>}
                      {s.verificationStatus === "verified" && <button className="btn-sm btn-out" onClick={()=>handleReject(s.id)}>✕ Unverify</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  );
}
