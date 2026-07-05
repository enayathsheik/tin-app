import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { CATEGORY_TREE, BUSINESS_TYPES } from "../data/constants";
import { ConfidenceBar } from "../components/shared/ConfidenceBar";

export function DiscoveryPage({ stores, selectedCity, user, isGuest, onRequireLogin }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [reportStore, setReportStore] = useState(null);
  const [suggestStore, setSuggestStore] = useState(null);
  const [claimStore, setClaimStore] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [suggestData, setSuggestData] = useState({});
  const [suggestSubmitted, setSuggestSubmitted] = useState(false);
  const [claimData, setClaimData] = useState({name:"",phone:"",email:"",gst:""});
  const [claimSubmitted, setClaimSubmitted] = useState(false);

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await addDoc(collection(db, "reports"), {
        storeId: reportStore.id, storeName: reportStore.storeName,
        reason: reportReason, note: reportNote,
        createdAt: serverTimestamp(), status: "pending",
      });
    } catch(e) { console.log("Report error:", e); }
    setReportSubmitted(true);
    setTimeout(() => { setReportStore(null); setReportSubmitted(false); setReportReason(""); setReportNote(""); }, 2000);
  };

  const handleSuggestEdit = async () => {
    if (!Object.keys(suggestData).length) return;
    try {
      await addDoc(collection(db, "suggestions"), {
        storeId: suggestStore.id, storeName: suggestStore.storeName,
        suggested: suggestData, createdAt: serverTimestamp(), status: "pending",
      });
    } catch(e) { console.log("Suggest error:", e); }
    setSuggestSubmitted(true);
    setTimeout(() => { setSuggestStore(null); setSuggestSubmitted(false); setSuggestData({}); }, 2000);
  };

  const handleClaim = async () => {
    if (!claimData.phone && !claimData.gst) return;
    try {
      await addDoc(collection(db, "claims"), {
        storeId: claimStore.id, storeName: claimStore.storeName,
        ...claimData, createdAt: serverTimestamp(), status: "pending",
      });
    } catch(e) { console.log("Claim error:", e); }
    setClaimSubmitted(true);
    setTimeout(() => { setClaimStore(null); setClaimSubmitted(false); setClaimData({name:"",phone:"",email:"",gst:""}); }, 3000);
  };

  const cats = ["All", ...Object.keys(CATEGORY_TREE)];
  const types = ["All", ...BUSINESS_TYPES];

  const filtered = stores.filter(s => {
    const searchLower = search.toLowerCase();
    const ms = (s.storeName||"").toLowerCase().includes(searchLower)
      || (s.city||"").toLowerCase().includes(searchLower)
      || (s.brands||"").toLowerCase().includes(searchLower)
      || (s.pincode||"").includes(search)
      || (s.address||"").toLowerCase().includes(searchLower)
      || (s.ownerName||"").toLowerCase().includes(searchLower)
      || (s.category||"").toLowerCase().includes(searchLower)
      || (s.categories||[]).some(c => (c.category||"").toLowerCase().includes(searchLower));
    const mc = catFilter === "All"
      || s.category === catFilter
      || (s.categories||[]).some(c => c.category === catFilter);
    const mt = typeFilter === "All" || s.businessType === typeFilter;
    const mst = statusFilter === "All" || s.verificationStatus === statusFilter;
    const mcity = !selectedCity || s.city === selectedCity;
    return ms && mc && mt && mst && mcity;
  });

  const isContrib = user?.role === "contributor";
  const [discMode, setDiscMode] = useState(isContrib ? "opportunity" : "database");
  const [savedNetwork, setSavedNetwork] = useState([]);
  const [locSearch, setLocSearch] = useState("");
  const [radius, setRadius] = useState(5);

  const handleSaveToNetwork = (item) => {
    setSavedNetwork(n => n.find(x => x.id === item.id) ? n : [...n, { ...item, savedAt: new Date().toISOString(), notes: "" }]);
  };

  const nearbyStores = stores.filter(s => s.city === (selectedCity || "Mumbai")).slice(0, 24);
  const verifiedNearby = nearbyStores.filter(s => s.verificationStatus === "verified");
  const pendingNearby = nearbyStores.filter(s => s.verificationStatus !== "verified");

  const OPPORTUNITY_INSIGHTS = [
    `This locality has ${nearbyStores.length} stores but only ${Math.floor(nearbyStores.length * 0.08)} architects on record.`,
    `${verifiedNearby.length} verified stores available for engagement nearby.`,
    pendingNearby.length > 0 && `${pendingNearby.length} stores are pending TIN review — contribute to verify them.`,
    "No designers from your network exist within this area.",
    "This market cluster is growing — 3 new stores added this week.",
  ].filter(Boolean);

  const SUGGESTED_EVENTS = [
    { icon: "🏢", name: "Dealer Meet — Mumbai North", date: "Jun 22", type: "Dealer Meet", city: selectedCity || "Mumbai" },
    { icon: "🎨", name: "Architect & Design Conclave", date: "Jun 28", type: "Architect Meet", city: selectedCity || "Mumbai" },
    { icon: "🏛", name: "ACETECH Mumbai 2025", date: "Jul 10", type: "Trade Exhibition", city: selectedCity || "Mumbai" },
    { icon: "🪵", name: "Hettich Product Launch", date: "Jul 15", type: "Product Launch", city: selectedCity || "Mumbai" },
    { icon: "🤝", name: "Contractor Network Evening", date: "Jul 18", type: "Networking", city: selectedCity || "Mumbai" },
  ];

  const SMART_RECS = [
    `${nearbyStores.length} verified stores are available within ${radius} km.`,
    "You have not added any architects to your network in this locality.",
    "8 contractors attended recent events near your territory.",
    "Expand your network by adding professionals from this category.",
  ];

  const LOCALITY_SUGGESTIONS = ["Andheri West", "Bandra Kurla", "Koramangala", "Banjara Hills", "Whitefield", "Powai", "Malad West", "Thane West"];

  const OpportunityEngine = () => (
    <div style={{maxWidth:760,margin:"0 auto",padding:"16px 16px 100px"}}>

      {/* MODE TOGGLE */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--s2)",borderRadius:"var(--r)",padding:4}}>
        {[["opportunity","⚡ Opportunities"],["database","🔍 Database Search"],["network","⭐ My Network"]].map(([id,label]) => (
          <button key={id} onClick={()=>setDiscMode(id)}
            style={{flex:1,padding:"7px 6px",borderRadius:"var(--r)",border:"none",fontSize:12,fontWeight:discMode===id?700:400,
              background:discMode===id?"var(--s1)":"transparent",color:discMode===id?"var(--acc)":"var(--t3)",cursor:"pointer",
              boxShadow:discMode===id?"0 1px 3px rgba(0,0,0,.08)":"none",fontFamily:"'Barlow',sans-serif",transition:"all .15s",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OPPORTUNITY MODE ── */}
      {discMode === "opportunity" && <>

        {/* LOCATION SEARCH */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:10}}>📍 Search by Location</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={locSearch} onChange={e=>setLocSearch(e.target.value)}
              placeholder="Area, locality, city or PIN code…"
              style={{flex:1,padding:"8px 12px",border:"1px solid var(--b3)",borderRadius:"var(--r)",fontSize:13,background:"var(--s1)",color:"var(--t1)",fontFamily:"'Barlow',sans-serif"}}/>
            <button style={{background:"var(--acc)",color:"white",border:"none",borderRadius:"var(--r)",padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif",whiteSpace:"nowrap"}}>
              📍 Near Me
            </button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {LOCALITY_SUGGESTIONS.map(l => (
              <span key={l} onClick={()=>setLocSearch(l)} style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:"var(--s2)",border:"1px solid var(--b2)",color:"var(--t3)",cursor:"pointer",fontWeight:500}}>
                {l}
              </span>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,color:"var(--t3)",whiteSpace:"nowrap"}}>Radius:</span>
            {[2,5,10,25].map(r => (
              <span key={r} onClick={()=>setRadius(r)} style={{fontSize:11,padding:"3px 9px",borderRadius:99,cursor:"pointer",fontWeight:600,
                background:radius===r?"var(--acc)":"var(--s2)",color:radius===r?"white":"var(--t3)",border:`1px solid ${radius===r?"var(--acc)":"var(--b2)"}`}}>
                {r} km
              </span>
            ))}
          </div>
        </div>

        {/* NEAR ME SUMMARY */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:13,color:"var(--t1)"}}>📍 Near Me — within {radius} km</div>
            <span style={{fontSize:11,color:"var(--t3)"}}>{selectedCity || "Mumbai"}</span>
          </div>
          {[
            { icon: "🏪", label: "Stores", count: nearbyStores.length, color: "var(--acc)" },
            { icon: "🎨", label: "Architects & Designers", count: Math.floor(nearbyStores.length * 0.08), color: "#7c3aed" },
            { icon: "🏗", label: "Contractors", count: Math.floor(nearbyStores.length * 0.05), color: "#0891b2" },
          ].map(row => (
            <div key={row.label} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:18,width:24}}>{row.icon}</div>
              <div style={{flex:1}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:row.color}}>{row.count}</span>
                <span style={{fontSize:12,color:"var(--t3)",marginLeft:6}}>{row.label}</span>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setDiscMode("database")} style={{fontSize:11,color:"var(--info)",background:"transparent",border:"1px solid var(--b2)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>View All</button>
                <button onClick={()=>handleSaveToNetwork({id:"near-"+row.label,storeName:row.label,city:selectedCity||"Mumbai"})} style={{fontSize:11,color:"var(--ok)",background:"transparent",border:"1px solid var(--b2)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>⭐ Save</button>
              </div>
            </div>
          ))}
        </div>

        {/* OPPORTUNITY INSIGHTS / WHITE SPACE */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:10}}>⚡ Opportunity Insights</div>
          {OPPORTUNITY_INSIGHTS.map((ins,i) => (
            <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid var(--b1)",alignItems:"flex-start"}}>
              <span style={{fontSize:14,color:"var(--warn)",flexShrink:0}}>⚡</span>
              <div style={{flex:1,fontSize:12,color:"var(--t2)",lineHeight:1.5}}>{ins}</div>
            </div>
          ))}
        </div>

        {/* SMART RECOMMENDATIONS */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:10}}>💡 Smart Recommendations</div>
          {SMART_RECS.map((rec,i) => (
            <div key={i} style={{display:"flex",gap:10,padding:"7px 10px",borderRadius:"var(--r)",background:"#eff6ff",border:"1px solid #bfdbfe",marginBottom:6,alignItems:"flex-start"}}>
              <span style={{fontSize:13,color:"#2563eb",flexShrink:0}}>💡</span>
              <div style={{flex:1,fontSize:12,color:"#1e40af",lineHeight:1.5}}>{rec}</div>
            </div>
          ))}
        </div>

        {/* SUGGESTED EVENTS */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:10}}>📅 Suggested Events Near You</div>
          {SUGGESTED_EVENTS.map((ev,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:22,flexShrink:0}}>{ev.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:1}}>{ev.name}</div>
                <div style={{fontSize:11,color:"var(--t3)"}}>{ev.type} · {ev.date} · {ev.city}</div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button style={{fontSize:11,color:"var(--ok)",background:"transparent",border:"1px solid var(--b2)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>Save</button>
                <button style={{fontSize:11,color:"white",background:"var(--acc)",border:"none",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>Register</button>
              </div>
            </div>
          ))}
        </div>

        {/* QUICK JUMP TO DATABASE */}
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <button onClick={()=>setDiscMode("database")} style={{background:"transparent",color:"var(--t3)",border:"1px solid var(--b3)",borderRadius:"var(--r)",padding:"9px 20px",fontSize:13,cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>
            🔍 Search the Database →
          </button>
        </div>
      </>}

      {/* ── MY NETWORK MODE ── */}
      {discMode === "network" && <>
        <div style={{marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--t1)",marginBottom:4}}>⭐ My Network</div>
          <div style={{fontSize:12,color:"var(--t3)"}}>People and businesses you follow, track, or want to engage with — regardless of whether you contributed them.</div>
        </div>
        {savedNetwork.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)"}}>
            <div style={{fontSize:36,marginBottom:8}}>⭐</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>Your network is empty</div>
            <div style={{fontSize:12,color:"var(--t3)",marginBottom:16,lineHeight:1.5}}>Save stores, architects, contractors, and professionals you discover to build your personal network.</div>
            <button onClick={()=>setDiscMode("opportunity")} style={{background:"var(--acc)",color:"white",border:"none",borderRadius:"var(--r)",padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>Discover Opportunities →</button>
          </div>
        ) : (
          <div>
            {savedNetwork.map((item,i) => (
              <div key={i} style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:20}}>🏪</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{item.storeName || item.name}</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>📍 {item.city} · Saved {item.savedAt?.substring(0,10)}</div>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button style={{fontSize:11,color:"var(--info)",background:"transparent",border:"1px solid var(--b2)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>📝 Note</button>
                  <button style={{fontSize:11,color:"var(--acc)",background:"transparent",border:"1px solid var(--b2)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:600}}>📅 Follow-up</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}

    </div>
  );

  if (discMode !== "database") {
    return <OpportunityEngine />;
  }

  return (
    <>
    <div className="discovery">

      {/* COLUMN 1 — FILTERS */}
      <div className={`disc-filters ${selected ? "collapsed" : ""}`}>
        <div className="srch">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--t3)", flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input placeholder={`Search store, brand, category, pincode, area${selectedCity ? ` in ${selectedCity}` : ""}...`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="chips" style={{ marginBottom: 6 }}>
          {["All", "verified", "community_added"].map(s => (
            <div key={s} className={`chip ${statusFilter === s ? "on" : ""}`} onClick={() => setStatusFilter(s)}>
              {s === "All" ? "All" : s === "verified" ? "✓ Verified" : "Community"}
            </div>
          ))}
        </div>
        <div className="chips" style={{ marginBottom: 6 }}>
          {cats.map(c => <div key={c} className={`chip ${catFilter === c ? "on" : ""}`} onClick={() => setCatFilter(c)}>{c}</div>)}
        </div>
        <div className="chips">
          {["All", "Retailer", "Distributor", "Wholesaler", "Contractor"].map(t => (
            <div key={t} className={`chip ${typeFilter === t ? "on" : ""}`} onClick={() => setTypeFilter(t)}>{t}</div>
          ))}
        </div>
      </div>

      {/* COLUMN 2 — STORE LIST */}
      <div className={`disc-list-col ${selected ? "hidden-mob" : ""}`}>
        <div className="disc-list-hd">
          <span style={{ fontSize: 11, color: "var(--t3)" }}>{filtered.length} records{selectedCity ? ` in ${selectedCity}` : ""}</span>
        </div>
        <div className="store-list">
          {filtered.map(s => (
            <div key={s.id} className={`sc ${selected?.id === s.id ? "sel" : ""}`} onClick={() => setSelected(s)}>
              <div className="sc-top">
                <div className="sc-name">{s.storeName}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <div className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>
                    {s.verificationStatus === "verified" ? "✓ Verified" : "Community"}
                  </div>
                  {s.gstVerified && <div className="badge" style={{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10}}>🏛 GST</div>}
                </div>
              </div>
              <div className="sc-meta">
                <span>📍 {s.city}</span>
                <span>🏪 {s.businessType}</span>
                <span>📦 {s.category}</span>
              </div>
              {s.brands && <div style={{ fontSize: "11px", color: "var(--t3)", marginTop: 4 }}>{s.brands.substring(0, 40)}{s.brands.length > 40 ? "..." : ""}</div>}
              <ConfidenceBar value={s.confidence} />
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--t3)" }}>No records found</div>}
        </div>
      </div>

      {/* COLUMN 3 — DETAIL */}
      <div className={`disc-main ${!selected ? "hidden-mob" : ""}`}>
        {selected ? (
          <div className="detail-panel">
            {/* STORE HEADER */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#080808"}}>{selected.storeName}</div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  <span className={`badge ${selected.verificationStatus==="verified"?"bv":"bc"}`}>
                    {selected.verificationStatus==="verified"?"✓ Verified":"⏳ Pending Verification"}
                  </span>
                  {selected.gstVerified && (
                    <span style={{fontSize:11,fontWeight:700,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",padding:"3px 10px",borderRadius:10}}>
                      🏛 GST Verified
                    </span>
                  )}
                  {selected.gstVerified && selected.gstVerifiedData && (
                    <span style={{fontSize:11,color:"#555",background:"#f8f8f8",border:"1px solid #e0e0e0",padding:"3px 10px",borderRadius:10}}>
                      {selected.gstVerifiedData.legalName}
                    </span>
                  )}
                  {selected.businessType && <span className="badge bp">{selected.businessType}</span>}
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{padding:"6px 14px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:700}}>← Back</button>
            </div>

            {/* CONTACT BUTTONS */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {selected.phone&&<a href={`tel:${selected.phone}`} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞 Call</a>}
              {selected.whatsapp&&<a href={`https://wa.me/91${selected.whatsapp}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>💬 WhatsApp</a>}
              {selected.instagram&&<a href={`https://instagram.com/${selected.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:"#fdf4ff",border:"1px solid #e9d5ff",color:"#7c3aed",fontSize:12,fontWeight:700,textDecoration:"none"}}>📸 Instagram</a>}
              {selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#080808",fontSize:12,fontWeight:700,textDecoration:"none"}}>🌐 Website</a>}
            </div>

            {/* ADDRESS */}
            {selected.address && <div style={{fontSize:13,color:"#080808",marginBottom:12,padding:"10px 14px",background:"#f8f8f8",borderRadius:8}}>📍 {selected.address}{selected.city?`, ${selected.city}`:""}{selected.state?`, ${selected.state}`:""}{selected.pincode?` - ${selected.pincode}`:""}</div>}

            {/* CATEGORIES */}
            {(selected.categories||[]).length>0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Product Categories</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(selected.categories||[]).map((c,i)=>(
                    <div key={i} style={{background:"#fff3ef",border:"1px solid #fde0d0",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#e85a2a",fontWeight:600}}>
                      {c.category}
                      {c.subCategory&&<span style={{fontSize:10,color:"#555",fontWeight:400}}> · {c.subCategory}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BRANDS */}
            {selected.brands && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Brands Available</div>
                <div style={{fontSize:13,color:"#080808"}}>{selected.brands}</div>
              </div>
            )}

            {/* OWNER */}
            {selected.ownerName && <div style={{fontSize:13,color:"#080808",marginBottom:10}}>👤 Owner: <strong>{selected.ownerName}</strong></div>}

            {/* ACTION BUTTONS */}
            <div style={{borderTop:"1px solid #f0f0f0",paddingTop:14,marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Community Actions</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>isGuest ? onRequireLogin() : setReportStore(selected)} style={{padding:"7px 14px",borderRadius:8,background:"#fff0f0",border:"1px solid #fecaca",color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>⚑ Report</button>
                <button onClick={()=>isGuest ? onRequireLogin() : setSuggestStore(selected)} style={{padding:"7px 14px",borderRadius:8,background:"#f0f0f0",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Suggest Edit</button>
                <button onClick={()=>isGuest ? onRequireLogin() : setClaimStore(selected)} style={{padding:"7px 14px",borderRadius:8,background:"#fff8f5",border:"1px solid #fde0d0",color:"#e85a2a",fontSize:12,fontWeight:700,cursor:"pointer"}}>🏷 Claim Business</button>
              </div>
            </div>

            {/* VERIFY INFO — admin only shown as badge */}
            {selected.verificationStatus!=="verified" && (
              <div style={{marginTop:10,padding:"8px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#d97706"}}>
                ⏳ This store is pending verification by the TIN team.
              </div>
            )}
          </div>
        ) : (
          <div className="empty-detail">
            <div style={{ fontSize: 40, opacity: .3 }}>🏪</div>
            <div>Select a store to view details</div>
            {selectedCity && <div style={{ fontSize: "12px" }}>Showing results for {selectedCity}</div>}
          </div>
        )}
      </div>
    </div>

    {/* ── REPORT MODAL ── */}
    {reportStore && (
      <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:400,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.15)"}}>
          {reportSubmitted ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>✅</div>
              <div style={{fontWeight:700,fontSize:16,color:"#080808"}}>Report Submitted</div>
              <div style={{fontSize:13,color:"#555",marginTop:6}}>TIN team will review this report.</div>
            </div>
          ) : <>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#080808",marginBottom:4}}>Report Store</div>
            <div style={{fontSize:13,color:"#555",marginBottom:16}}>{reportStore.storeName}</div>
            <div style={{fontSize:11,fontWeight:700,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Reason</div>
            {["Wrong information","Duplicate listing","Business closed","Malpractice / Fraud","Spam"].map(r=>(
              <div key={r} onClick={()=>setReportReason(r)} style={{padding:"9px 14px",borderRadius:8,border:`1px solid ${reportReason===r?"#e85a2a":"#e0e0e0"}`,background:reportReason===r?"#fff3ef":"#fff",cursor:"pointer",fontSize:13,color:"#080808",fontWeight:reportReason===r?700:400,marginBottom:6}}>
                {reportReason===r?"● ":"○ "}{r}
              </div>
            ))}
            <div style={{marginTop:10,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Additional Details (optional)</div>
              <textarea className="fta" placeholder="Add more context..." value={reportNote} onChange={e=>setReportNote(e.target.value)} rows={3} />
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleReport} disabled={!reportReason} style={{flex:1,padding:"9px",borderRadius:8,background:reportReason?"#dc2626":"#f5f5f5",border:"none",color:reportReason?"white":"#888",fontSize:13,fontWeight:700,cursor:reportReason?"pointer":"default"}}>Submit Report</button>
              <button onClick={()=>setReportStore(null)} style={{padding:"9px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
            </div>
          </>}
        </div>
      </div>
    )}

    {/* ── SUGGEST EDIT MODAL ── */}
    {suggestStore && (
      <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:440,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.15)",maxHeight:"85vh",overflowY:"auto"}}>
          {suggestSubmitted ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>✅</div>
              <div style={{fontWeight:700,fontSize:16,color:"#080808"}}>Suggestion Submitted</div>
              <div style={{fontSize:13,color:"#555",marginTop:6}}>TIN team will review and update the listing.</div>
            </div>
          ) : <>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#080808",marginBottom:4}}>Suggest Edit</div>
            <div style={{fontSize:13,color:"#555",marginBottom:4}}>{suggestStore.storeName}</div>
            <div style={{fontSize:12,color:"#d97706",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 12px",marginBottom:16}}>Your suggestion will be reviewed by TIN team before publishing.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[["Store Name","storeName"],["Phone","phone"],["WhatsApp","whatsapp"],["Address","address"],["City","city"],["Pincode","pincode"],["Website","website"],["Instagram","instagram"],["Brands","brands"],["Owner Name","ownerName"]].map(([label,key])=>(
                <div key={key}>
                  <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                  <input className="fi" style={{fontSize:12}} placeholder={suggestStore[key]||`Enter ${label.toLowerCase()}...`} value={suggestData[key]||""} onChange={e=>setSuggestData(d=>({...d,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleSuggestEdit} style={{flex:1,padding:"9px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>Submit Suggestion</button>
              <button onClick={()=>setSuggestStore(null)} style={{padding:"9px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
            </div>
          </>}
        </div>
      </div>
    )}

    {/* ── CLAIM BUSINESS MODAL ── */}
    {claimStore && (
      <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:440,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.15)"}}>
          {claimSubmitted ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>🎉</div>
              <div style={{fontWeight:700,fontSize:16,color:"#080808"}}>Claim Request Submitted!</div>
              <div style={{fontSize:13,color:"#555",marginTop:6,lineHeight:1.6}}>TIN team will verify your ownership and link this listing to your account within 2-3 business days.</div>
            </div>
          ) : <>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#080808",marginBottom:4}}>Claim This Business</div>
            <div style={{fontSize:13,color:"#555",marginBottom:4}}>{claimStore.storeName}</div>
            <div style={{fontSize:12,color:"#1d4ed8",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 12px",marginBottom:16,lineHeight:1.5}}>
              Fill your business details below. TIN team will verify and link this listing to your account.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[["Your Name","name","Full name"],["Mobile Number","phone","Registered phone"],["Email","email","Business email"],["GST Number","gst","GST for verification"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:10,fontWeight:700,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label} {key!=="gst"&&<span style={{color:"#e85a2a"}}>*</span>}</div>
                  <input className="fi" style={{fontSize:12}} placeholder={ph} value={claimData[key]||""} onChange={e=>setClaimData(d=>({...d,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:14,lineHeight:1.5}}>By submitting this claim you confirm this is your legitimate business listing. False claims may result in account suspension.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleClaim} disabled={!claimData.phone&&!claimData.email} style={{flex:1,padding:"9px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>Submit Claim</button>
              <button onClick={()=>setClaimStore(null)} style={{padding:"9px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
            </div>
          </>}
        </div>
      </div>
    )}

    </>
  );
}
