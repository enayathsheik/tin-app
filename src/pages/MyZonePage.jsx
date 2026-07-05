import { useState } from "react";

export function MyZonePage({ user, stores, onNavigate }) {
  const [tab, setTab] = useState("stores");
  const [search, setSearch] = useState("");
  const [insightDismissed, setInsightDismissed] = useState(false);

  const uid = user.uid || user.id;
  const userName = user.name || "Champion";
  const points = user.points || 0;
  const city = user.city || "Mumbai";

  // Derive my contributions from stores list
  const myStores = stores.filter(s => s.contributorId === uid || s.contributorEmail === user.email || s.contributorId === "u1");
  const myArchitects = (user.architects || []);
  const myContractors = (user.contractors || []);
  const myEvents = (user.events || []);

  const totalStores = myStores.length;
  const totalArchitects = myArchitects.length;
  const totalContractors = myContractors.length;
  const totalEvents = myEvents.length;

  // Activity score: weighted formula
  const activityScore = Math.min(100, Math.round(
    (totalStores * 5) + (totalArchitects * 8) + (totalContractors * 8) + (totalEvents * 10) + (points * 0.02)
  ));

  // Territory health
  const healthScore = Math.min(100, Math.round(activityScore * 0.6 + (totalStores > 0 ? 20 : 0) + (totalEvents > 0 ? 10 : 0) + (points > 100 ? 10 : 0)));
  const healthLabel = healthScore >= 75 ? "🟢 Excellent" : healthScore >= 50 ? "🟡 Moderate" : "🔴 Needs Attention";
  const healthColor = healthScore >= 75 ? "var(--ok)" : healthScore >= 50 ? "var(--warn)" : "#dc2626";

  const STATUS_LABELS = {
    verified: { label: "✅ Verified by TIN", color: "var(--ok)", bg: "#f0fdf4" },
    community_added: { label: "🟡 Pending Review", color: "var(--warn)", bg: "#fffbeb" },
    pending: { label: "🟡 Pending Review", color: "var(--warn)", bg: "#fffbeb" },
    needs_info: { label: "🔴 Needs Info", color: "#dc2626", bg: "#fef2f2" },
    rejected: { label: "⚫ Inactive", color: "#555", bg: "#f5f5f5" },
  };

  const getStatus = (s) => STATUS_LABELS[s?.verificationStatus] || STATUS_LABELS["community_added"];

  const filteredStores = myStores.filter(s =>
    !search || s.storeName?.toLowerCase().includes(search.toLowerCase()) || s.city?.toLowerCase().includes(search.toLowerCase())
  );

  const SMART_INSIGHTS = [
    totalStores === 0 && "Add your first store to start building your territory.",
    totalStores > 0 && myStores.filter(s => s.verificationStatus !== "verified").length > 0 &&
      `${myStores.filter(s => s.verificationStatus !== "verified").length} stores are pending TIN verification.`,
    totalEvents === 0 && "Log your first market event to boost your activity score.",
    points < 500 && `Earn ${500 - points} more points to reach Gold Builder status.`,
    totalArchitects === 0 && "Add architects & designers to grow your influence network.",
  ].filter(Boolean).slice(0, 3);

  const SUGGESTED_EVENTS = [
    { icon: "🏢", name: "Dealer Meet — Mumbai North", date: "Jun 22", type: "Dealer Meet" },
    { icon: "🎨", name: "Architect & Design Conclave", date: "Jun 28", type: "Architect Meet" },
    { icon: "🏛", name: "ACETECH Mumbai 2025", date: "Jul 10", type: "Trade Exhibition" },
    { icon: "🪵", name: "Hettich Product Launch", date: "Jul 15", type: "Product Launch" },
  ];

  const BADGES = [
    { icon: "🏪", name: "Store Builder", unlocked: totalStores >= 5, req: "5 stores" },
    { icon: "🎨", name: "Influencer Connector", unlocked: totalArchitects >= 3, req: "3 architects" },
    { icon: "🏗", name: "Contractor Champion", unlocked: totalContractors >= 3, req: "3 contractors" },
    { icon: "📅", name: "Event Explorer", unlocked: totalEvents >= 2, req: "2 events" },
    { icon: "🚀", name: "Market Leader", unlocked: points >= 1000, req: "1,000 pts" },
    { icon: "🌟", name: "Territory Builder", unlocked: healthScore >= 75, req: "75% health" },
  ];

  const card = (label, value, icon, color) => (
    <div key={label} style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",flex:1,minWidth:0}}>
      <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:color||"var(--t1)",lineHeight:1}}>{value}</div>
      <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{label}</div>
    </div>
  );

  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{maxWidth:760,margin:"0 auto",padding:"20px 16px 100px"}}>

        {/* HEADER */}
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"var(--t1)",marginBottom:2}}>🗺 My Zone</div>
          <div style={{fontSize:13,color:"var(--t3)"}}>Your personal market territory & network command center</div>
        </div>

        {/* SMART INSIGHTS */}
        {!insightDismissed && SMART_INSIGHTS.length > 0 && (
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:14,position:"relative"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#1d4ed8",marginBottom:6}}>💡 Smart Insights</div>
            {SMART_INSIGHTS.map((ins, i) => (
              <div key={i} style={{fontSize:12,color:"#1e40af",padding:"3px 0",lineHeight:1.5}}>· {ins}</div>
            ))}
            <div onClick={() => setInsightDismissed(true)} style={{position:"absolute",top:10,right:12,fontSize:14,color:"#93c5fd",cursor:"pointer"}}>✕</div>
          </div>
        )}

        {/* KPI CARDS ROW 1 */}
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          {card("My Stores", totalStores, "🏪", "var(--acc)")}
          {card("Architects", totalArchitects, "🎨", "#7c3aed")}
          {card("Contractors", totalContractors, "🏗", "#0891b2")}
          {card("Events", totalEvents, "📅", "#059669")}
        </div>

        {/* KPI CARDS ROW 2 */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",flex:1}}>
            <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>⭐ Activity Score</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:"var(--acc)"}}>{activityScore}</div>
              <div style={{flex:1,height:6,background:"var(--b2)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${activityScore}%`,background:"var(--acc)",borderRadius:99}}/>
              </div>
              <div style={{fontSize:11,color:"var(--t3)"}}>/100</div>
            </div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",flex:1}}>
            <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>🌍 Territory Health</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:healthColor}}>{healthScore}%</div>
              <div style={{flex:1}}>
                <div style={{height:6,background:"var(--b2)",borderRadius:99,overflow:"hidden",marginBottom:3}}>
                  <div style={{height:"100%",width:`${healthScore}%`,background:healthColor,borderRadius:99}}/>
                </div>
                <div style={{fontSize:10,color:healthColor,fontWeight:700}}>{healthLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAV */}
        <div style={{display:"flex",gap:4,marginBottom:14,background:"var(--s2)",borderRadius:"var(--r)",padding:4}}>
          {[
            ["stores","🏪 My Stores"],
            ["architects","🎨 Architects"],
            ["contractors","🏗 Contractors"],
            ["events","📅 Events"],
          ].map(([id,label]) => (
            <button key={id} onClick={() => { setTab(id); setSearch(""); }}
              style={{flex:1,padding:"7px 4px",borderRadius:"var(--r)",border:"none",fontSize:12,fontWeight:tab===id?700:400,
                background:tab===id?"var(--s1)":"transparent",color:tab===id?"var(--acc)":"var(--t3)",cursor:"pointer",
                boxShadow:tab===id?"0 1px 3px rgba(0,0,0,.08)":"none",fontFamily:"'Barlow',sans-serif",transition:"all .15s"}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── MY STORES TAB ── */}
        {tab === "stores" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stores or city…"
                style={{flex:1,padding:"8px 12px",border:"1px solid var(--b3)",borderRadius:"var(--r)",fontSize:13,background:"var(--s1)",color:"var(--t1)",fontFamily:"'Barlow',sans-serif"}}/>
              <button onClick={() => onNavigate("add")}
                style={{background:"var(--acc)",color:"white",border:"none",borderRadius:"var(--r)",padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Barlow',sans-serif"}}>
                + Add Store
              </button>
            </div>
            {filteredStores.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"var(--t3)"}}>
                <div style={{fontSize:36,marginBottom:8}}>🏪</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>No stores yet</div>
                <div style={{fontSize:12,marginBottom:16}}>Start building your territory by adding stores in your area.</div>
                <button onClick={() => onNavigate("add")} style={{background:"var(--acc)",color:"white",border:"none",borderRadius:"var(--r)",padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>Add Your First Store →</button>
              </div>
            ) : filteredStores.map(s => {
              const st = getStatus(s);
              return (
                <div key={s.id} style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:"var(--t1)",marginBottom:2}}>{s.storeName}</div>
                      <div style={{fontSize:11,color:"var(--t3)",marginBottom:6}}>📍 {s.address ? `${s.address}, ` : ""}{s.city} · {s.businessType || "Store"}</div>
                      {s.categories?.length > 0 && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                          {s.categories.slice(0,3).map((c,i) => (
                            <span key={i} style={{fontSize:10,background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"2px 6px",color:"var(--t3)"}}>
                              {c.category||c}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{display:"inline-flex",alignItems:"center",fontSize:11,fontWeight:700,color:st.color,background:st.bg,borderRadius:4,padding:"2px 7px"}}>
                        {st.label}
                      </div>
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      {s.phone && <div style={{fontSize:12,color:"var(--info)"}}>{s.phone}</div>}
                      <div style={{fontSize:10,color:"var(--t3)",marginTop:4}}>{s.createdAt || "Recently added"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ARCHITECTS TAB ── */}
        {tab === "architects" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search architects…"
                style={{flex:1,padding:"8px 12px",border:"1px solid var(--b3)",borderRadius:"var(--r)",fontSize:13,background:"var(--s1)",color:"var(--t1)",fontFamily:"'Barlow',sans-serif"}}/>
              <button onClick={() => onNavigate("add")}
                style={{background:"#7c3aed",color:"white",border:"none",borderRadius:"var(--r)",padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Barlow',sans-serif"}}>
                + Add Architect
              </button>
            </div>
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--t3)"}}>
              <div style={{fontSize:36,marginBottom:8}}>🎨</div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>No architects added yet</div>
              <div style={{fontSize:12,marginBottom:16}}>Add architects & interior designers you've met in the field.</div>
              <button onClick={() => onNavigate("add")} style={{background:"#7c3aed",color:"white",border:"none",borderRadius:"var(--r)",padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>Add First Architect →</button>
            </div>
          </div>
        )}

        {/* ── CONTRACTORS TAB ── */}
        {tab === "contractors" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contractors…"
                style={{flex:1,padding:"8px 12px",border:"1px solid var(--b3)",borderRadius:"var(--r)",fontSize:13,background:"var(--s1)",color:"var(--t1)",fontFamily:"'Barlow',sans-serif"}}/>
              <button onClick={() => onNavigate("add")}
                style={{background:"#0891b2",color:"white",border:"none",borderRadius:"var(--r)",padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Barlow',sans-serif"}}>
                + Add Contractor
              </button>
            </div>
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--t3)"}}>
              <div style={{fontSize:36,marginBottom:8}}>🏗</div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>No contractors added yet</div>
              <div style={{fontSize:12,marginBottom:16}}>Add contractors from your market visits to grow your network.</div>
              <button onClick={() => onNavigate("add")} style={{background:"#0891b2",color:"white",border:"none",borderRadius:"var(--r)",padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>Add First Contractor →</button>
            </div>
          </div>
        )}

        {/* ── EVENTS TAB ── */}
        {tab === "events" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--t1)"}}>Market Activity Log</div>
              <button style={{background:"#059669",color:"white",border:"none",borderRadius:"var(--r)",padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
                📅 Add Event
              </button>
            </div>
            {myEvents.length === 0 && (
              <div style={{textAlign:"center",padding:"30px 20px",color:"var(--t3)",marginBottom:16}}>
                <div style={{fontSize:32,marginBottom:8}}>📅</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>No events logged yet</div>
                <div style={{fontSize:12}}>Log dealer meets, site visits, exhibitions, and client meetings.</div>
              </div>
            )}
            <div style={{fontWeight:700,fontSize:13,color:"var(--t2)",marginBottom:10}}>📌 Suggested Events Near You</div>
            {SUGGESTED_EVENTS.map((e,i) => (
              <div key={i} style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"11px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:22,flexShrink:0}}>{e.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:2}}>{e.name}</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>{e.type} · {e.date}</div>
                </div>
                <button style={{fontSize:12,color:"var(--acc)",background:"transparent",border:"1px solid var(--acc)",borderRadius:"var(--r)",padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap",fontWeight:700,fontFamily:"'Barlow',sans-serif"}}>
                  Register
                </button>
              </div>
            ))}
          </div>
        )}

        {/* BADGES */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginTop:14}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:10}}>🏅 Achievement Badges</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BADGES.map(b => (
              <div key={b.name} style={{background:b.unlocked?"#f0fdf4":"var(--s2)",border:`1px solid ${b.unlocked?"#86efac":"var(--b1)"}`,borderRadius:"var(--r)",padding:"10px 8px",textAlign:"center",opacity:b.unlocked?1:0.55}}>
                <div style={{fontSize:22,marginBottom:4}}>{b.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:b.unlocked?"var(--ok)":"var(--t3)",lineHeight:1.3}}>{b.name}</div>
                {!b.unlocked && <div style={{fontSize:9,color:"var(--t3)",marginTop:2}}>{b.req}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* NETWORK IMPACT */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"14px 16px",marginTop:10}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:8}}>🌐 Your Network Impact</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
            {[
              ["🏪",totalStores,"Stores in network"],
              ["🎨",totalArchitects,"Architects connected"],
              ["🏗",totalContractors,"Contractors linked"],
              ["📅",totalEvents,"Events participated"],
            ].map(([icon,val,label]) => (
              <div key={label} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--s2)",borderRadius:"var(--r)"}}>
                <div style={{fontSize:18}}>{icon}</div>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"var(--t1)",lineHeight:1}}>{val}</div>
                  <div style={{fontSize:10,color:"var(--t3)"}}>{label}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:"var(--t3)",lineHeight:1.6,borderTop:"1px solid var(--b1)",paddingTop:10}}>
            Your network contributes to building material decisions across <strong style={{color:"var(--t2)"}}>{city}</strong> and surrounding areas. Keep growing your territory to increase your market influence.
          </div>
        </div>

      </div>
    </div>
  );
}
