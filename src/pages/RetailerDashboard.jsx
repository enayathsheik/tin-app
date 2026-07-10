import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { EXHIBITIONS } from "../data/constants";
import { MultiCategorySelector } from "../components/shared/MultiCategorySelector";
import { DiscoveryPage } from "./DiscoveryPage";
import { StaffProfilePage } from "./StaffProfilePage";
import { ProfilePage } from "./ProfilePage";
import { InspiPage } from "./InspiPage";
import { RetailerJobsPage } from "./RetailerJobsPage";

const RETAILER_NAV_ITEMS = [["home","🏠","My Business"],["discover","🔍","Discover"],["inspi","🖼","Inspi"],["jobs","💼","Jobs"],["staff","👥","Staff"],["deals","🏷","Deals"],["profile","👤","Profile"]];

export function RetailerDashboard({ user, stores, onNavigate }) {
  const [activeTab, setActiveTab] = useState("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [storeProfile, setStoreProfile] = useState({
    storeName: user.storeName || "",
    address: user.address || "",
    city: user.city || "",
    state: user.state || "",
    pincode: user.pincode || "",
    phone: user.phone || "",
    whatsapp: user.whatsapp || "",
    instagram: user.instagram || "",
    facebook: user.facebook || "",
    website: user.website || "",
    categories: user.categories || [],
    brands: user.brands || "",
    gst: user.gst || "",
    verificationStatus: user.verificationStatus || "pending",
  });
  const [locations, setLocations] = useState(user.locations || []);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name:"", address:"", city:"", phone:"", whatsapp:"" });
  const [events, setEvents] = useState(user.customEvents || []);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name:"", date:"", venue:"", city:"" });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analytics, setAnalytics] = useState({ instagram: user.igFollowers||0, facebook: user.fbFollowers||0, google: user.googleRating||0, profileViews: 1248 });

  // Count products from categories
  const totalCategories = (storeProfile.categories||[]).length;
  const totalSubCats = (storeProfile.categories||[]).reduce((s,c) => s + (c.subCategory?1:0), 0);
  const totalProducts = (storeProfile.categories||[]).reduce((s,c) => s + (c.productType ? c.productType.split(",").length : 0), 0);

  const handleShare = () => {
    const text = `${storeProfile.storeName}\n${storeProfile.address}, ${storeProfile.city}\nPhone: ${storeProfile.phone}${storeProfile.whatsapp ? "\nWhatsApp: " + storeProfile.whatsapp : ""}${storeProfile.website ? "\nWeb: " + storeProfile.website : ""}`;
    navigator.clipboard?.writeText(text);
    alert("Store contact copied to clipboard!");
  };

  const saveProfile = async () => {
    try {
      if (user.uid) {
        await updateDoc(doc(db, "users", user.uid), { ...storeProfile, locations, customEvents: events });
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { console.log("Save error:", e); setEditing(false); }
  };

  const addLocation = () => {
    if (!newLocation.name) return;
    setLocations(l => [...l, { ...newLocation, id: Date.now().toString() }]);
    setNewLocation({ name:"", address:"", city:"", phone:"", whatsapp:"" });
    setShowAddLocation(false);
  };

  const addEvent = () => {
    if (!newEvent.name) return;
    setEvents(e => [...e, { ...newEvent, id: Date.now().toString(), custom: true }]);
    setNewEvent({ name:"", date:"", venue:"", city:"" });
    setShowAddEvent(false);
  };

  return (
    <div className="retailer-layout" style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* MOBILE TOPBAR — hamburger trigger, hidden on desktop */}
      <div className="retailer-mobile-topbar">
        <button type="button" className="retailer-menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">☰</button>
        <div className="retailer-mobile-title">{RETAILER_NAV_ITEMS.find(([id]) => id === activeTab)?.[2] || "My Business"}</div>
      </div>

      {/* OVERLAY — closes the drawer on tap, mobile only */}
      {mobileNavOpen && <div className="retailer-nav-overlay" onClick={() => setMobileNavOpen(false)} />}

      {/* SIDEBAR NAV — static sidebar on desktop, slide-in drawer on mobile */}
      <div className={`retailer-sidebar ${mobileNavOpen ? "open" : ""}`} style={{width:200,flexShrink:0,background:"#fff",borderRight:"1px solid #e0e0e0",padding:"16px 12px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:".12em",color:"#e85a2a",padding:"4px 10px"}}>BUSINESS PORTAL</div>
          <button type="button" className="retailer-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">✕</button>
        </div>
        {RETAILER_NAV_ITEMS.map(([id,icon,label]) => (
          <div key={id}
            onClick={() => { setActiveTab(id); setMobileNavOpen(false); }}
            style={{padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:activeTab===id?"#e85a2a":"#080808",background:activeTab===id?"#fff3ef":"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
            <span style={{fontSize:15}}>{icon}</span>{label}
            {id==="deals"&&<span style={{fontSize:9,background:"#e85a2a",color:"white",padding:"1px 5px",borderRadius:10,fontWeight:700,marginLeft:"auto"}}>NEW</span>}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"12px 10px",background:"#fff8f5",borderRadius:8,border:"1px solid #fde0d0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#e85a2a",marginBottom:4}}>Profile Completeness</div>
          <div style={{fontSize:22,fontWeight:800,color:"#080808",fontFamily:"'Barlow Condensed',sans-serif"}}>
            {Math.min(100, 20 + (storeProfile.phone?10:0) + (storeProfile.address?10:0) + (storeProfile.website?10:0) + (storeProfile.instagram?10:0) + (storeProfile.categories?.length>0?10:0) + (storeProfile.brands?10:0) + (storeProfile.gst?10:0) + (storeProfile.whatsapp?10:0))}%
          </div>
          <div style={{height:4,background:"#f0f0f0",borderRadius:2,marginTop:4,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#e85a2a",borderRadius:2,width:`${Math.min(100, 20 + (storeProfile.phone?10:0) + (storeProfile.address?10:0) + (storeProfile.website?10:0) + (storeProfile.instagram?10:0) + (storeProfile.categories?.length>0?10:0) + (storeProfile.brands?10:0) + (storeProfile.gst?10:0) + (storeProfile.whatsapp?10:0))}%`}}/>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="retailer-content" style={{flex:1,overflowY:"auto",background:"#f5f5f5"}}>

        {/* ---- HOME TAB ---- */}
        {activeTab === "home" && (
          <div style={{padding:24,maxWidth:900,margin:"0 auto"}}>

            {saved && <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 16px",fontSize:13,color:"#16a34a",marginBottom:14}}>✓ Profile saved successfully!</div>}

            {/* STORE IDENTITY CARD */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  {editing ? (
                    <input style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,border:"none",borderBottom:"2px solid #e85a2a",outline:"none",color:"#080808",width:"100%",background:"transparent"}}
                      value={storeProfile.storeName} onChange={e => setStoreProfile(s=>({...s,storeName:e.target.value}))} placeholder="Store Name" />
                  ) : (
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"#080808"}}>{storeProfile.storeName || user.name || "Your Store Name"}</div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    {storeProfile.verificationStatus==="verified"
                      ? <span style={{fontSize:11,color:"#16a34a",fontWeight:700,background:"#f0fdf4",padding:"2px 8px",borderRadius:20,border:"1px solid #bbf7d0"}}>✓ Verified Business</span>
                      : <span style={{fontSize:11,color:"#d97706",fontWeight:700,background:"#fffbeb",padding:"2px 8px",borderRadius:20,border:"1px solid #fde68a"}}>⏳ Verification Pending</span>
                    }
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {!editing
                    ? <button onClick={()=>setEditing(true)} style={{padding:"7px 14px",borderRadius:8,background:"#fff3ef",border:"1px solid #fde0d0",color:"#e85a2a",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button>
                    : <>
                        <button onClick={saveProfile} style={{padding:"7px 14px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button>
                        <button onClick={()=>setEditing(false)} style={{padding:"7px 14px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                      </>
                  }
                  <button onClick={handleShare} style={{padding:"7px 14px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Share</button>
                </div>
              </div>

              {/* ADDRESS + CONTACT */}
              {editing ? (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                  {[["Address","address","123 Shop, Street"],["City","city","Mumbai"],["State","state","Maharashtra"],["Pincode","pincode","400001"],["Phone","phone","9820012345"],["WhatsApp","whatsapp","9820012345"],["Instagram","instagram","@yourstore"],["Facebook","facebook","facebook.com/yourstore"],["Website","website","www.yourstore.com"],["GST Number","gst","27AABCS1429B1ZB"]].map(([label,key,ph]) => (
                    <div key={key}>
                      <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                      <input className="fi" placeholder={ph} value={storeProfile[key]||""} onChange={e=>setStoreProfile(s=>({...s,[key]:e.target.value}))} style={{fontSize:12}} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{fontSize:13,color:"#080808",marginBottom:12}}>📍 {storeProfile.address}{storeProfile.city?`, ${storeProfile.city}`:""}{storeProfile.state?`, ${storeProfile.state}`:""}{storeProfile.pincode?` - ${storeProfile.pincode}`:""}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {storeProfile.phone&&<a href={`tel:${storeProfile.phone}`} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞 Call</a>}
                    {storeProfile.whatsapp&&<a href={`https://wa.me/91${storeProfile.whatsapp}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>💬 WhatsApp</a>}
                    {storeProfile.instagram&&<a href={`https://instagram.com/${storeProfile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#fdf4ff",border:"1px solid #e9d5ff",color:"#7c3aed",fontSize:12,fontWeight:700,textDecoration:"none"}}>📸 Instagram</a>}
                    {storeProfile.facebook&&<a href={storeProfile.facebook} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",fontSize:12,fontWeight:700,textDecoration:"none"}}>📘 Facebook</a>}
                    {storeProfile.website&&<a href={storeProfile.website} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#080808",fontSize:12,fontWeight:700,textDecoration:"none"}}>🌐 Website</a>}
                  </div>
                </>
              )}
            </div>

            {/* STATS ROW */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[[totalProducts||0,"Products","📦"],[totalCategories||0,"Categories","🏷"],[totalSubCats||0,"Sub-categories","📋"],[locations.length+1,"Locations","📍"]].map(([v,l,icon]) => (
                <div key={l} style={{background:"#fff",borderRadius:10,border:"1px solid #e0e0e0",padding:16,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:"#e85a2a"}}>{v}</div>
                  <div style={{fontSize:11,color:"#080808",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>

            {/* PRODUCT CATEGORIES */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>Product Portfolio</div>
                <button onClick={()=>setEditing(true)} style={{padding:"6px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Products</button>
              </div>
              {(storeProfile.categories||[]).length === 0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:"#888",fontSize:13}}>No products added yet. Click Edit to add your product categories.</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                  {(storeProfile.categories||[]).map((c,i) => (
                    <div key={i} style={{background:"#f8f8f8",borderRadius:8,padding:10,border:"1px solid #e8e8e8"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#e85a2a",marginBottom:3}}>{c.category}</div>
                      {c.subCategory&&<div style={{fontSize:11,color:"#080808",marginBottom:2}}>{c.subCategory}</div>}
                      {c.productType&&<div style={{fontSize:10,color:"#555"}}>{c.productType}</div>}
                    </div>
                  ))}
                </div>
              )}
              {editing && (
                <div style={{marginTop:14,borderTop:"1px solid #f0f0f0",paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#080808",marginBottom:8}}>Edit Categories</div>
                  <MultiCategorySelector selected={storeProfile.categories||[]} onChange={cats=>setStoreProfile(s=>({...s,categories:cats}))} />
                </div>
              )}
            </div>

            {/* LOCATIONS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>My Locations</div>
                <button onClick={()=>setShowAddLocation(true)} style={{padding:"6px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Location</button>
              </div>

              {/* Main location */}
              <div style={{background:"#fff8f5",borderRadius:10,padding:14,border:"1px solid #fde0d0",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{storeProfile.storeName||"Main Store"} <span style={{fontSize:10,background:"#e85a2a",color:"white",padding:"1px 6px",borderRadius:10,marginLeft:4}}>Main</span></div>
                    <div style={{fontSize:12,color:"#555",marginTop:3}}>{storeProfile.address}{storeProfile.city?`, ${storeProfile.city}`:""}</div>
                    <div style={{fontSize:12,color:"#080808",fontWeight:600,marginTop:4}}>{storeProfile.phone}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {storeProfile.phone&&<a href={`tel:${storeProfile.phone}`} style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞</a>}
                    {storeProfile.whatsapp&&<a href={`https://wa.me/91${storeProfile.whatsapp}`} target="_blank" rel="noreferrer" style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>💬</a>}
                  </div>
                </div>
              </div>

              {/* Additional locations */}
              {locations.map((loc,i) => (
                <div key={loc.id||i} style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e8e8e8",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{loc.name}</div>
                      <div style={{fontSize:12,color:"#555",marginTop:3}}>{loc.address}{loc.city?`, ${loc.city}`:""}</div>
                      <div style={{fontSize:12,color:"#080808",fontWeight:600,marginTop:4}}>{loc.phone}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {loc.phone&&<a href={`tel:${loc.phone}`} style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞</a>}
                      {loc.whatsapp&&<a href={`https://wa.me/91${loc.whatsapp}`} target="_blank" rel="noreferrer" style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>💬</a>}
                      <button onClick={()=>setLocations(l=>l.filter((_,idx)=>idx!==i))} style={{padding:"4px 8px",borderRadius:6,background:"#fff0f0",border:"1px solid #fecaca",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Location Form */}
              {showAddLocation && (
                <div style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e0e0e0",marginTop:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#080808",marginBottom:10}}>Add New Location</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["Branch Name","name","e.g. Branch 1"],["Address","address","Street address"],["City","city","City"],["Phone","phone","Mobile number"],["WhatsApp","whatsapp","WhatsApp number"]].map(([label,key,ph]) => (
                      <div key={key}>
                        <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                        <input className="fi" placeholder={ph} value={newLocation[key]||""} onChange={e=>setNewLocation(l=>({...l,[key]:e.target.value}))} style={{fontSize:12}} />
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={addLocation} style={{padding:"7px 16px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add Location</button>
                    <button onClick={()=>setShowAddLocation(false)} style={{padding:"7px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* ANALYTICS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808",marginBottom:14}}>Analytics Overview</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[["📸","Instagram",analytics.instagram,"Followers"],["📘","Facebook",analytics.facebook,"Followers"],["⭐","Google Rating",analytics.google,"Stars"]].map(([icon,label,val,unit]) => (
                  <div key={label} style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e8e8e8",textAlign:"center"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#e85a2a"}}>{val||"—"}</div>
                    <div style={{fontSize:11,color:"#080808",fontWeight:600}}>{label}</div>
                    <div style={{fontSize:10,color:"#555"}}>{unit}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12,color:"#555",marginBottom:8}}>Update your social stats:</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["Instagram Followers","instagram"],["Facebook Followers","facebook"],["Google Rating","google"]].map(([label,key]) => (
                  <div key={key}>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                    <input className="fi" placeholder="0" type="number" value={analytics[key]||""} onChange={e=>setAnalytics(a=>({...a,[key]:e.target.value}))} style={{fontSize:12}} />
                  </div>
                ))}
              </div>
            </div>

            {/* EVENTS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>Upcoming Exhibitions & Events</div>
                <button onClick={()=>setShowAddEvent(true)} style={{padding:"6px 12px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Event</button>
              </div>
              {[...EXHIBITIONS, ...events].map((ev,i) => (
                <div key={ev.id||i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
                  <div style={{textAlign:"center",background:"#fff3ef",borderRadius:8,padding:"8px 12px",minWidth:48,flexShrink:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"#e85a2a",lineHeight:1}}>{ev.date?.split(" ")[0]}</div>
                    <div style={{fontSize:10,fontWeight:700,color:"#e85a2a"}}>{ev.date?.split(" ")[1]}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>{ev.venue}</div>
                    <div style={{fontSize:11,color:"#080808",marginTop:1}}>📍 {ev.city}</div>
                  </div>
                  {!ev.custom && <button style={{padding:"5px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:11,fontWeight:700,cursor:"pointer"}}>Register</button>}
                  {ev.custom && <button onClick={()=>setEvents(e=>e.filter((_,idx)=>idx!==i-EXHIBITIONS.length))} style={{padding:"5px 10px",borderRadius:8,background:"#fff0f0",border:"1px solid #fecaca",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>}
                </div>
              ))}
              {showAddEvent && (
                <div style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e0e0e0",marginTop:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#080808",marginBottom:10}}>Add Your Event</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["Event Name","name","e.g. Showroom Launch"],["Date","date","e.g. Jul 15"],["Venue","venue","Venue name"],["City","city","City"]].map(([label,key,ph]) => (
                      <div key={key}>
                        <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                        <input className="fi" placeholder={ph} value={newEvent[key]||""} onChange={e=>setNewEvent(ev=>({...ev,[key]:e.target.value}))} style={{fontSize:12}} />
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={addEvent} style={{padding:"7px 16px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add Event</button>
                    <button onClick={()=>setShowAddEvent(false)} style={{padding:"7px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---- DISCOVER TAB ---- */}
        {activeTab === "discover" && <DiscoveryPage stores={stores} selectedCity={null} user={null} />}

        {/* ---- INSPI TAB ---- */}
        {activeTab === "inspi" && <InspiPage user={user} isGuest={false} onRequireLogin={() => {}} />}

        {/* ---- JOBS TAB ---- */}
        {activeTab === "jobs" && <RetailerJobsPage user={user} />}

        {/* ---- STAFF TAB ---- */}
        {activeTab === "staff" && <StaffProfilePage user={user} />}

        {/* ---- DEALS TAB ---- */}
        {activeTab === "deals" && (
          <div style={{padding:24,maxWidth:700,margin:"0 auto"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:"#080808",marginBottom:4}}>Deals & Tools</div>
            <div style={{fontSize:13,color:"#555",marginBottom:24}}>Grow your business with TIN tools and offers</div>
            {[
              {icon:"🤖",title:"AI Visualiser",desc:"Let your customers visualise your products in their space using AI. Upload product images and generate room visualisations instantly.",status:"coming"},
              {icon:"📸",title:"Upload Client Testimonials",desc:"Showcase happy customers. Upload photos and reviews from your clients to build trust with new buyers.",status:"coming"},
              {icon:"🎨",title:"Design Inspiration Gallery",desc:"Upload design inspiration images featuring your products. Help architects and designers discover your range.",status:"coming"},
              {icon:"📊",title:"Business Analytics Pro",desc:"Deep analytics — track profile views, enquiries, WhatsApp clicks, catalogue downloads and more.",status:"coming"},
              {icon:"🏷",title:"Featured Listing",desc:"Get your business featured at the top of search results in your city and category.",status:"coming"},
            ].map(d => (
              <div key={d.title} style={{background:"#fff",borderRadius:12,border:"1px solid #e0e0e0",padding:20,marginBottom:12,display:"flex",alignItems:"center",gap:16}}>
                <div style={{fontSize:32,flexShrink:0}}>{d.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#080808",marginBottom:3}}>{d.title}</div>
                  <div style={{fontSize:12,color:"#555",lineHeight:1.5}}>{d.desc}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,background:"#e85a2a",color:"white",padding:"3px 8px",borderRadius:10,whiteSpace:"nowrap",flexShrink:0}}>Coming Soon</span>
              </div>
            ))}
          </div>
        )}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === "profile" && <ProfilePage user={user} showJobPosts={false} />}

      </div>
    </div>
  );
}
