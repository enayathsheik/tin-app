import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getDocs, query, collection, where, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, saveUserProfile, getUserProfile } from "../firebase/config";
import { ROLES } from "../data/constants";
import { getLevel } from "../utils/helpers";

export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("contributor");
  const [email, setEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  const isContrib = role === "contributor";
  const comingSoonRoles = [];
  const visibleRoles = ROLES.filter(r => r.id !== "manufacturer" && r.id !== "admin");

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSent(true);
    } catch(err) {
      alert("Could not send reset email. Please check the address.");
    }
  };

  const doSubmit = async () => {
    const emailToUse = (mode === "register" && isContrib ? workEmail : email).trim();
    const passToUse = pass.trim();
    if (!emailToUse || !passToUse) {
      alert("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        // LOGIN — role loaded from Firebase automatically
        const cred = await signInWithEmailAndPassword(auth, emailToUse, passToUse);
        const isAdminEmail = emailToUse.toLowerCase() === "enayathsheik@gmail.com";
        const profile = await getUserProfile(cred.user.uid);
        if (profile) {
          const finalProfile = isAdminEmail ? { ...profile, role: "admin" } : profile;
          onLogin({ ...finalProfile, uid: cred.user.uid });
        } else {
          const basicProfile = { name: emailToUse.split("@")[0], email: emailToUse, workEmail: emailToUse, personalEmail: "", role: isAdminEmail ? "admin" : "contributor", linkedin: "", company: "", points: 0, storesAdded: 0, citiesCovered: 0, level: getLevel(0).name, validationStatus: "n/a", createdAt: new Date().toISOString(), uid: cred.user.uid };
          await saveUserProfile(cred.user.uid, basicProfile);
          onLogin(basicProfile);
        }
      } else {
        // REGISTER — role selection matters here
        const cred = await createUserWithEmailAndPassword(auth, emailToUse, passToUse);
        const ud = {
          name: name || emailToUse.split("@")[0],
          email: emailToUse,
          workEmail: isContrib ? workEmail : emailToUse,
          personalEmail,
          role,
          linkedin,
          company: isContrib ? workEmail.split("@")[1]?.split(".")[0] || "" : "",
          points: 0,
          storesAdded: 0,
          citiesCovered: 0,
          level: getLevel(0).name,
          validationStatus: isContrib ? (linkedin ? "pending" : "unvalidated") : "n/a",
          referralCode: "TIN" + (name||emailToUse).replace(/[^A-Z0-9]/gi,"").substring(0,5).toUpperCase() + Math.floor(Math.random()*900+100),
          referredBy: referralCode.trim().toUpperCase() || null,
          createdAt: new Date().toISOString(),
          uid: cred.user.uid
        };
        await saveUserProfile(cred.user.uid, ud);
        // If a referral code was entered, find the referrer and credit 50 points (pending validation)
        if (referralCode.trim()) {
          try {
            const refSnap = await getDocs(query(collection(db, "users"), where("referralCode", "==", referralCode.trim().toUpperCase())));
            if (!refSnap.empty) {
              const referrerId = refSnap.docs[0].id;
              // Points awarded when the new contributor gets validated (store pending status for now)
              await addDoc(collection(db, "referrals"), {
                referrerId, referralCode: referralCode.trim().toUpperCase(),
                newUserId: cred.user.uid, newUserEmail: emailToUse,
                status: "pending", // becomes 'credited' after admin validates new user
                pointsToAward: 50,
                createdAt: serverTimestamp(),
              });
            }
          } catch(e) { console.log("Referral processing error:", e); }
        }
        onLogin(ud);
      }
    } catch(err) {
      const msg = err.message
        .replace("Firebase: ", "")
        .replace("(auth/email-already-in-use)", "Email already registered — please sign in.")
        .replace("(auth/wrong-password)", "Wrong password.")
        .replace("(auth/user-not-found)", "No account found — please register.")
        .replace("(auth/invalid-credential)", "Invalid email or password.")
        .replace("(auth/weak-password)", "Password must be at least 6 characters.");
      alert(msg);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (mode === "register" && role === "retailer") {
      setShowRoleConfirm(true);
      return;
    }
    await doSubmit();
  };

  // Forgot password screen
  if (showForgot) return (
    <div className="login-pg">
      <div className="login-card">
        <div className="login-logo">Trade Interface Network</div>
        <div className="login-title">Reset <em>Password</em></div>
        <div className="login-sub">Enter your registered email — we will send a reset link.</div>
        {forgotSent ? (
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"var(--r)",padding:"12px 16px",fontSize:13,color:"#16a34a",marginBottom:14}}>
            ✓ Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
          </div>
        ) : (
          <div className="login-fields">
            <div className="lf"><label>Email Address</label><input className="fi" type="email" placeholder="your@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} /></div>
          </div>
        )}
        {!forgotSent && <button className="btn-login" onClick={handleForgotPassword}>Send Reset Link →</button>}
        <div className="login-sw" style={{marginTop:14}}><span onClick={() => { setShowForgot(false); setForgotSent(false); }}>← Back to Login</span></div>
      </div>
    </div>
  );

  return (
    <div className="login-pg">
      <div className="login-card">
        <div className="login-logo">Trade Interface Network</div>
        <div className="login-title">Welcome to <em>TIN</em></div>
        <div className="login-sub">
          {mode === "login" ? "Sign in to your account." : "Create your TIN account — select your role first."}
        </div>

        {/* ROLE SELECTOR — only shown during registration */}
        {mode === "register" && (
          <div className="role-grid" style={{marginBottom:16}}>
            {visibleRoles.map(r => {
              const isComingSoon = comingSoonRoles.includes(r.id);
              return (
                <div key={r.id}
                  className={`role-opt ${role === r.id ? "on" : ""}`}
                  onClick={() => !isComingSoon && setRole(r.id)}
                  style={isComingSoon ? {opacity:0.5,cursor:"default"} : {}}>
                  <div className="role-icon">{r.icon}</div>
                  <div className="role-lbl">{r.label}</div>
                  {isComingSoon
                    ? <div style={{fontSize:10,color:"#e85a2a",fontWeight:700,marginTop:2}}>Coming Soon</div>
                    : <div className="role-desc">{r.desc}</div>
                  }
                </div>
              );
            })}
          </div>
        )}

        {/* CONTRIBUTOR EXTRA FIELDS — only on register */}
        {mode === "register" && isContrib && (
          <div className="contrib-note">✍️ Market Champions need a company work email. LinkedIn is optional.</div>
        )}

        <div className="login-fields">
          {mode === "register" && (
            <div className="lf"><label>Full Name</label><input className="fi" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} /></div>
          )}

          {mode === "register" && isContrib ? (
            <>
              <div className="lf">
                <label>Work Email <span style={{color:"#e85a2a"}}>*</span></label>
                <input className="fi" type="email" placeholder="you@yourcompany.com" value={workEmail} onChange={e => setWorkEmail(e.target.value)} />
              </div>
              <div className="lf"><label>Personal Email (backup)</label><input className="fi" type="email" placeholder="you@gmail.com" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></div>
              <div className="lf"><label>LinkedIn <span style={{fontSize:10,color:"#555",fontWeight:400}}>(optional)</span></label><input className="fi" placeholder="linkedin.com/in/yourname" value={linkedin} onChange={e => setLinkedin(e.target.value)} /></div>
            </>
          ) : (
            <>
              <div className="lf">
                <label>Email</label>
                <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
              {mode === "register" && (
                <div className="lf"><label>Personal Email (backup)</label><input className="fi" type="email" placeholder="backup@gmail.com" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></div>
              )}
            </>
          )}

          <div className="lf">
            <label>Password</label>
            <input className="fi" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {mode === "register" && (
            <div className="lf">
              <label>Referral Code <span style={{fontSize:10,color:"#555",fontWeight:400}}>(optional — if someone referred you)</span></label>
              <input className="fi" placeholder="e.g. TINSUMAI898" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} style={{letterSpacing:".08em",fontWeight:600}} />
            </div>
          )}
        </div>

        <button className="btn-login" onClick={handleSubmit} disabled={loading} style={{opacity:loading?0.7:1}}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>

        {mode === "login" && (
          <div style={{textAlign:"center",marginTop:10}}>
            <span onClick={() => setShowForgot(true)} style={{fontSize:12,color:"#e85a2a",cursor:"pointer",fontWeight:600}}>Forgot password?</span>
          </div>
        )}

        <div className="login-sw">
          {mode === "login"
            ? <>New to TIN? <span onClick={() => setMode("register")}>Create account</span></>
            : <>Already have account? <span onClick={() => setMode("login")}>Sign in</span></>
          }
        </div>
        <div style={{textAlign:"center",marginTop:16,paddingTop:12,borderTop:"1px solid #f0f0f0"}}>
          <span onClick={() => window.location.hash = "#admin"} style={{fontSize:11,color:"#888",cursor:"pointer",textDecoration:"none"}} onMouseOver={e=>e.target.style.color="#e85a2a"} onMouseOut={e=>e.target.style.color="#888"}>
            TIN Team / Admin Login →
          </span>
        </div>
      </div>
      {showRoleConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", fontFamily: "'Barlow', sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 12, color: "#080808" }}>Registering as a Retailer?</div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 24 }}>
              Retailer accounts are for business owners managing their store on TIN. If you're a sales professional who wants to add stores and earn points, choose Market Champion instead.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => { setShowRoleConfirm(false); doSubmit(); }} style={{ padding: "10px 20px", background: "#e85a2a", color: "#fff", border: "none", borderRadius: 8, fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Yes, I'm a Retailer</button>
              <button onClick={() => { setShowRoleConfirm(false); setRole("contributor"); }} style={{ padding: "10px 20px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#080808" }}>Switch to Market Champion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
