import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, query, where, orderBy, doc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db, getUserProfile, updateUserStats } from "./firebase/config";
import { MOCK_STORES } from "./data/constants";
import { G } from "./data/globalStyles";
import { Toast } from "./components/shared/Toast";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { LoginPage } from "./pages/LoginPage";
import { RetailerDashboard } from "./pages/RetailerDashboard";
import { MarketChampionHome } from "./pages/MarketChampionHome";
import { ConsumerHome } from "./pages/ConsumerHome";
import { ContractorHome } from "./pages/ContractorHome";
import { ArchitectHome } from "./pages/ArchitectHome";
import { HeroPage } from "./pages/HeroPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { AddPage } from "./pages/AddPage";
import { RewardsPage } from "./pages/RewardsPage";
import { StaffProfilePage } from "./pages/StaffProfilePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { DealsPage } from "./pages/DealsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MyZonePage } from "./pages/MyZonePage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { InspiPage } from "./pages/InspiPage";
import { JobsPage } from "./pages/JobsPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [stores, setStores] = useState(MOCK_STORES);
  const [contributors, setContributors] = useState([]);
  const [storesLoadFailed, setStoresLoadFailed] = useState(false);
  const [contributorsLoadFailed, setContributorsLoadFailed] = useState(false);

  // Load real stores from Firestore on mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const snap = await getDocs(query(collection(db, "stores"), orderBy("createdAt", "desc")));
        if (!snap.empty) {
          const firestoreStores = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
          }));
          // Merge with mock stores, Firebase data takes priority
          setStores([...firestoreStores, ...MOCK_STORES]);
        }
      } catch(e) {
        console.error("[hero-stats] Failed to load stores from Firestore — falling back to baseline stats:", e);
        // Fall back to mock data
        setStores(MOCK_STORES);
        setStoresLoadFailed(true);
      }
    };
    loadStores();

    // Load real contributors from Firestore
    const loadContributors = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "contributor")));
        const base = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
        // Stats (points/storesAdded/citiesCovered) live in a subcollection — merge per contributor
        const realContributors = await Promise.all(base.map(async (c) => {
          const statsSnap = await getDoc(doc(db, "users", c.id, "stats", "summary"));
          return { ...c, ...(statsSnap.exists() ? statsSnap.data() : { points: 0, storesAdded: 0, citiesCovered: 0 }) };
        }));
        setContributors(realContributors);
      } catch(e) {
        console.error("[hero-stats] Failed to load contributors from Firestore — falling back to baseline stats:", e);
        setContributors([]);
        setContributorsLoadFailed(true);
      }
    };
    loadContributors();
  }, []);
  const [selectedCity, setSelectedCity] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: "", type: "ok" });
  const [pendingBusinessType, setPendingBusinessType] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showLoginPage, setShowLoginPage] = useState(false);

  // Persistent login — check auth state on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            // Override role to admin if email matches admin email
            const isAdminEmail = firebaseUser.email === "enayathsheik@gmail.com";
            const finalProfile = isAdminEmail ? { ...profile, role: "admin" } : profile;
            setUser({ ...finalProfile, uid: firebaseUser.uid });
            setPage(isAdminEmail ? "admin" : (profile.role === "admin" ? "admin" : "home"));
          }
        } catch(e) { console.log("Profile load error:", e); }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setPage("home");
  };

  const showToast = (msg, type = "ok") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const handleCitySelect = (city) => { setSelectedCity(city); };
  const handleExplore = () => setPage("discover");
  const handleAddStore = () => { if (!user) { setShowLoginPage(true); return; } setPage("add"); };
  const handleMessageAdmin = () => { if (!user) { setShowLoginPage(true); return; } showToast("Message sent to admin! We will contact you within 24 hours.", "ok"); };

  const handleSubmitStore = async (data) => {
    const newStores = [data, ...stores];
    setStores(newStores);
    const myCities = [...new Set(
      newStores
        .filter(s => s.contributorId === user.uid || s.contributorEmail === user.email)
        .map(s => s.city)
        .filter(Boolean)
    )];
    // Points/storesAdded are already credited by AddPage.jsx's own stats write — only
    // citiesCovered is computed here, since it needs the full stores list App.jsx holds.
    const awardedPoints = data.pointsAwarded || 10;
    setUser(u => ({ ...u, points: (u.points||0)+awardedPoints, storesAdded: (u.storesAdded||0)+1, citiesCovered: myCities.length }));
    if (user?.uid && user.uid !== "admin") {
      try {
        await updateUserStats(user.uid, { citiesCovered: myCities.length });
      } catch(e) { console.log("Points update:", e.message); }
    }
    setShowThankYou(true);
    setTimeout(() => { setShowThankYou(false); setPage("home"); }, 3000);
  };

  const isContrib = user?.role === "contributor";
  const isRetailer = user?.role === "retailer";
  const isConsumer = user?.role === "consumer";
  const isContractor = user?.role === "contractor";
  const isArchitect = user?.role === "architect";
  const showLeaderboard = isContrib;
  const TABS = !user
    ? [
        ["home","Home"],
        ["discover","Discover"],
        ["inspi","Inspi"],
        ["jobs","Jobs"],
        ["login","Login"],
      ]
    : user.role === "admin"
    ? [["admin","Admin Panel"],["inspi","Browse Inspi"],["jobs","Browse Jobs"]]
    : isRetailer
    ? [] // Retailer uses internal sidebar nav
    : [
        ["home","Home"],
        ["discover","Discover"],
        ["inspi","Inspi"],
        ["jobs","Jobs"],
        ["add","+ Add Store"],
        ...(isContrib ? [["rewards","⭐ Rewards"]] : []),
        ...(isContrib ? [["myzone","🗺 My Zone"]] : []),
        ["staff","Staff"],
        ...(showLeaderboard ? [["leaderboard","Leaderboard"]] : []),
        ["deals","Deals"],
        ["profile","Profile"],
      ];

  // Check if accessing admin panel via URL hash
  const isAdminRoute = typeof window !== "undefined" && window.location.hash === "#admin";
  const [showAdminLogin, setShowAdminLogin] = useState(isAdminRoute);

  if (authLoading) return <><style>{G}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f4f5f7",flexDirection:"column",gap:12}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:28,color:"var(--acc)"}}>TIN</div><div style={{fontSize:13,color:"#080808"}}>Loading...</div></div></>;
  if (!user && showAdminLogin) return <><style>{G}</style><div className={"light"} style={{background:"#f4f5f7",minHeight:"100vh"}}><AdminLoginPage onAdminLogin={(u) => { setUser(u); setPage("admin"); setShowAdminLogin(false); }} /></div></>;
  if (!user && showLoginPage) {
    return (
      <>
        <style>{G}</style>
        <div className="light" style={{ background: "#f4f5f7", minHeight: "100vh" }}>
          <LoginPage onLogin={(u) => { setUser(u); setShowLoginPage(false); setPage(u.role === "admin" ? "admin" : "home"); }} />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{G}</style>
      <div className="app light" style={{background:"#f4f5f7",color:"#080808",minHeight:"100vh"}}>
        <nav className="topbar">
          <div className="logo" onClick={() => setPage("home")} style={{cursor:"pointer"}}>T<em>I</em>N</div>
          {!isRetailer && (
            <div className="nav-tabs">
              {TABS.map(([id, label]) => (
                <button key={id} className={`ntab ${page === id ? "on" : ""}`} onClick={() => id === "login" ? setShowLoginPage(true) : setPage(id)}>{label}</button>
              ))}
            </div>
          )}
          <div className="topbar-right">
            {user ? (
              <>
                {selectedCity && <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>📍 {selectedCity}</div>}
                {user.role !== "admin" && user.role !== "retailer" && <div className="pts-badge">{user.points || 0} pts</div>}
                <div className="avatar" onClick={() => setPage("profile")}>{user.name.charAt(0).toUpperCase()}</div>
                <button onClick={handleLogout} style={{padding:"4px 10px",borderRadius:8,background:"transparent",border:"1px solid var(--b3)",color:"#080808",fontSize:12,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}} title="Logout">↩ Out</button>
              </>
            ) : (
              <>
                {selectedCity && <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>📍 {selectedCity}</div>}
                <button onClick={() => setShowLoginPage(true)} style={{padding:"6px 14px",borderRadius:8,background:"#e85a2a",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Login</button>
              </>
            )}
          </div>
        </nav>
        {showThankYou && (
          <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:24,padding:32,maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
              <div style={{fontSize:48,marginBottom:12}}>🎉</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,marginBottom:8,color:"#080808"}}>Thank You!</div>
              <div style={{fontSize:14,color:"#555",marginBottom:20,lineHeight:1.6}}>Store submitted! You earned <strong style={{color:"#e85a2a"}}>+10 points</strong> for contributing to TIN.</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>{setShowThankYou(false);setPage("discover");}} style={{padding:"9px 18px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>View in Discover →</button>
                <button onClick={()=>{setShowThankYou(false);setPage("home");}} style={{padding:"9px 18px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:13,fontWeight:700,cursor:"pointer"}}>Go Home</button>
              </div>
            </div>
          </div>
        )}
        {/* MOBILE BOTTOM NAV */}
        {!isRetailer && user?.role !== "admin" && (
          <div className="mobile-nav">
            {(user
              ? [
                  ["home","🏠","Home"],
                  ["discover","🔍","Discover"],
                  ["inspi","🖼","Inspi"],
                  ["jobs","💼","Jobs"],
                  ["add","➕","Add"],
                  ...(isContrib ? [["rewards","⭐","Rewards"]] : []),
                  ...(isContrib ? [["myzone","🗺","My Zone"]] : []),
                  ["profile","👤","Profile"],
                ]
              : [
                  ["home","🏠","Home"],
                  ["discover","🔍","Discover"],
                  ["inspi","🖼","Inspi"],
                  ["jobs","💼","Jobs"],
                  ["login","👤","Login"],
                ]
            ).map(([id,icon,label]) => (
              <div key={id} className={`mobile-nav-item ${page===id?"on":""}`} onClick={() => id === "login" ? setShowLoginPage(true) : id === "add" ? handleAddStore() : setPage(id)}>
                <span className="mobile-nav-icon">{icon}</span>
                <span className="mobile-nav-label" style={{color:page===id?"#e85a2a":"#888"}}>{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="page">
          {page === "home" && (isRetailer
            ? <RetailerDashboard user={user} stores={stores} onNavigate={setPage} />
            : isContrib
            ? <MarketChampionHome
                user={user}
                contributors={contributors}
                onAddStore={() => setPage("add")}
                onLeaderboard={() => setPage("leaderboard")}
                onRewards={() => setPage("rewards")}
                onDiscover={() => setPage("discover")}
              />
            : isConsumer
            ? <ConsumerHome user={user} onDiscover={() => setPage("discover")} onBrowseCategory={() => setPage("discover")} />
            : isContractor
            ? <ContractorHome user={user} onFindSuppliers={() => { setPendingBusinessType("Distributor"); setPage("discover"); }} onProfile={() => setPage("profile")} />
            : isArchitect
            ? <ArchitectHome user={user} onDiscover={() => setPage("discover")} onProfile={() => setPage("profile")} />
            : <HeroPage onCitySelect={handleCitySelect} selectedCity={selectedCity} onExplore={handleExplore} onAdd={handleAddStore} stores={stores} contributors={contributors} storesLoadFailed={storesLoadFailed} contributorsLoadFailed={contributorsLoadFailed} />
          )}
          {page === "discover" && <DiscoveryPage stores={stores} selectedCity={selectedCity} user={user} isGuest={!user} onRequireLogin={() => setShowLoginPage(true)} initialBusinessType={pendingBusinessType} />}
          {page === "inspi" && <InspiPage user={user} isGuest={!user} onRequireLogin={() => setShowLoginPage(true)} toast={showToast} />}
          {page === "jobs" && <JobsPage user={user} isGuest={!user} onRequireLogin={() => setShowLoginPage(true)} toast={showToast} />}
          {page === "add" && <AddPage user={user} onSubmit={handleSubmitStore} toast={showToast} />}
          {page === "rewards" && <RewardsPage user={user} onMessageAdmin={handleMessageAdmin} />}
          {page === "staff" && <StaffProfilePage user={user} />}
          {page === "leaderboard" && <LeaderboardPage contributors={contributors} />}
          {page === "deals" && <DealsPage />}
          {page === "profile" && <ProfilePage user={user} onUpdateUser={(updated) => setUser(updated)} />}
          {page === "myzone" && <MyZonePage user={user} stores={stores} onNavigate={setPage} />}
          {page === "admin" && <AdminDashboard stores={stores} contributors={contributors} />}
        </div>
        <Toast {...toast} />
      </div>
    </>
  );
}
