import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getDocs, query, collection, where, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, saveUserProfile, getUserProfile } from "../firebase/config";
import { ROLES } from "../data/constants";
import { getLevel } from "../utils/helpers";
import { checkHandleAvailable, claimHandle, findAvailableHandle, isReservedHandle, isValidHandleFormat, suggestHandleBase } from "../utils/handles";
import { normalizeIndianMobile, phoneToSyntheticEmail, resolveAuthEmail } from "../utils/phoneAuth";

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
  const [forgotPhoneBlocked, setForgotPhoneBlocked] = useState(false);
  // Register-mode identifier method — "email" (unchanged default) or
  // "mobile" (Part 1: mobile signup, no OTP — see src/utils/phoneAuth.js).
  // Contributor (Market Champion) signup keeps its existing work-email-only
  // flow untouched — a business validation email doesn't make sense to
  // replace with a phone number, so this toggle only appears for the other
  // roles (see the isContrib guard around its render below).
  const [signupMethod, setSignupMethod] = useState("email");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [handleStatus, setHandleStatus] = useState("idle"); // idle|checking|available|taken|invalid|reserved

  const isContrib = role === "contributor";
  const comingSoonRoles = [];
  const visibleRoles = ROLES.filter(r => r.id !== "manufacturer" && r.id !== "admin");

  // Auto-suggests a handle from the entered name — findAvailableHandle already
  // appends digits until it lands on a free one — as long as the user hasn't
  // started editing the handle field themselves.
  useEffect(() => {
    if (mode !== "register" || handleEdited) return;
    const base = suggestHandleBase(name);
    if (base.length < 3) { setHandleStatus("idle"); return; }
    setHandleStatus("checking");
    const t = setTimeout(async () => {
      try {
        const found = await findAvailableHandle(base);
        setHandle(found);
        setHandleStatus("available");
      } catch {
        setHandleStatus("invalid");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [name, mode, handleEdited]);

  // Live availability check for manual edits (debounced).
  useEffect(() => {
    if (mode !== "register" || !handleEdited) return;
    const h = handle.trim().toLowerCase();
    if (!h) { setHandleStatus("idle"); return; }
    if (!isValidHandleFormat(h)) { setHandleStatus("invalid"); return; }
    if (isReservedHandle(h)) { setHandleStatus("reserved"); return; }
    setHandleStatus("checking");
    const t = setTimeout(async () => {
      try {
        const ok = await checkHandleAvailable(h);
        setHandleStatus(ok ? "available" : "taken");
      } catch {
        setHandleStatus("invalid");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [handle, handleEdited, mode]);

  // Mobile accounts have no real inbox behind their synthetic email (see
  // src/utils/phoneAuth.js) — sending a reset link there would "succeed"
  // from Firebase's point of view while silently reaching nobody. Detect a
  // phone-shaped identifier up front and say so plainly instead; email
  // identifiers go through the exact same reset flow as before, unchanged.
  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setForgotPhoneBlocked(false);
    const resolved = resolveAuthEmail(forgotEmail);
    if (resolved.error) {
      alert(resolved.error);
      return;
    }
    if (resolved.isPhone) {
      setForgotPhoneBlocked(true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resolved.email);
      setForgotSent(true);
    } catch(err) {
      alert("Could not send reset email. Please check the address.");
    }
  };

  // Register-mode mobile signup only ever applies outside the contributor
  // (Market Champion) role — see the signupMethod state comment above.
  const isMobileSignup = mode === "register" && !isContrib && signupMethod === "mobile";

  const doSubmit = async () => {
    // Resolves the actual Firebase Auth email for this attempt. Email paths
    // (login-by-email, register-by-email, contributor work-email) are byte
    // -identical to before this change — only the two mobile branches are
    // new (see src/utils/phoneAuth.js for the normalisation rule).
    let emailToUse;
    let phoneDigits = null;
    let usedPhoneLogin = false;
    if (mode === "login") {
      const resolved = resolveAuthEmail(email);
      if (resolved.error) { alert(resolved.error); return; }
      emailToUse = resolved.email;
      usedPhoneLogin = resolved.isPhone;
      phoneDigits = resolved.phone || null;
    } else if (isMobileSignup) {
      const digits = normalizeIndianMobile(mobile);
      if (!digits) { alert("Enter a valid 10-digit mobile number."); return; }
      phoneDigits = digits;
      emailToUse = phoneToSyntheticEmail(digits);
    } else {
      emailToUse = (isContrib ? workEmail : email).trim();
    }

    const passToUse = pass.trim();
    if (!emailToUse || !passToUse) {
      alert(mode === "login" ? "Please enter your email or mobile number, and password" : (isMobileSignup ? "Please enter your mobile number and password" : "Please enter email and password"));
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
          const basicProfile = { name: phoneDigits || emailToUse.split("@")[0], email: emailToUse, phone: phoneDigits, workEmail: emailToUse, personalEmail: "", role: isAdminEmail ? "admin" : "contributor", linkedin: "", company: "", points: 0, storesAdded: 0, citiesCovered: 0, level: getLevel(0).name, validationStatus: "n/a", createdAt: new Date().toISOString(), uid: cred.user.uid };
          await saveUserProfile(cred.user.uid, basicProfile);
          onLogin(basicProfile);
        }
      } else {
        // REGISTER — role selection matters here
        const cred = await createUserWithEmailAndPassword(auth, emailToUse, passToUse);
        const ud = {
          name: name || emailToUse.split("@")[0],
          email: emailToUse,
          // Real mobile number lives here — the synthetic email above is an
          // internal auth-identity detail only, never shown to the user
          // (see src/utils/phoneAuth.js). null for email signups, unchanged.
          phone: phoneDigits,
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
        try {
          await claimHandle(cred.user.uid, handle, { role, displayName: ud.name, city: "", photoUrl: null, points: 0, storesAdded: 0, specialization: "", categories: [] });
          ud.handle = handle;
        } catch (handleErr) {
          console.error("[signup] Handle claim failed:", handleErr);
        }
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
      // Phone-attempt phrasing never leaks the synthetic email — same
      // Firebase error codes, wording chosen from what THIS attempt used.
      const isPhoneAttempt = isMobileSignup || usedPhoneLogin;
      const msg = err.message
        .replace("Firebase: ", "")
        .replace("(auth/email-already-in-use)", isPhoneAttempt ? "Mobile number already registered — please sign in." : "Email already registered — please sign in.")
        .replace("(auth/wrong-password)", "Wrong password.")
        .replace("(auth/user-not-found)", isPhoneAttempt ? "No account found for this mobile number — please register." : "No account found — please register.")
        .replace("(auth/invalid-credential)", isPhoneAttempt ? "Invalid mobile number or password." : "Invalid email or password.")
        .replace("(auth/weak-password)", "Password must be at least 6 characters.");
      alert(msg);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (mode === "register" && handleStatus !== "available") {
      alert("Please choose an available handle before continuing.");
      return;
    }
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
        <div className="login-sub">Enter your registered email or mobile number — email accounts get a reset link.</div>
        {forgotSent ? (
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"var(--r)",padding:"12px 16px",fontSize:13,color:"#16a34a",marginBottom:14}}>
            ✓ Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
          </div>
        ) : forgotPhoneBlocked ? (
          <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:"var(--r)",padding:"12px 16px",fontSize:13,color:"#9a3412",marginBottom:14}}>
            Mobile-number accounts don't have a recovery email on file — self-serve reset isn't available yet. Please contact support or an admin to reset your password.
          </div>
        ) : (
          <div className="login-fields">
            <div className="lf"><label>Email or Mobile Number</label><input className="fi" placeholder="your@email.com or 98765 43210" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotPhoneBlocked(false); }} /></div>
          </div>
        )}
        {!forgotSent && !forgotPhoneBlocked && <button className="btn-login" onClick={handleForgotPassword}>Send Reset Link →</button>}
        <div className="login-sw" style={{marginTop:14}}><span onClick={() => { setShowForgot(false); setForgotSent(false); setForgotPhoneBlocked(false); }}>← Back to Login</span></div>
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

          {mode === "register" && (
            <div className="lf">
              <label>Your tinit ID <span style={{ fontSize: 10, color: "#555", fontWeight: 400 }}>(your public profile URL — tinit.in/@handle)</span></label>
              <input
                className="fi"
                placeholder="yourhandle"
                value={handle}
                onChange={e => { setHandleEdited(true); setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); }}
              />
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color:
                handleStatus === "available" ? "#16a34a" :
                handleStatus === "checking" ? "#888" :
                handleStatus === "idle" ? "#888" : "#dc2626"
              }}>
                {handleStatus === "available" && `✓ tinit.in/@${handle} is available`}
                {handleStatus === "taken" && "✗ That handle is already taken"}
                {handleStatus === "invalid" && "Handle must be 3–20 lowercase letters, numbers, or underscores"}
                {handleStatus === "reserved" && "✗ That handle is reserved"}
                {handleStatus === "checking" && "Checking availability…"}
                {handleStatus === "idle" && "Enter your name above to get a suggestion"}
              </div>
            </div>
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
          ) : mode === "login" ? (
            <div className="lf">
              <label>Email or Mobile Number</label>
              <input className="fi" placeholder="you@example.com or 98765 43210" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          ) : (
            <>
              <div className="lf">
                <label>Sign up with</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => setSignupMethod("email")} style={{ padding: "8px 16px", borderRadius: 8, border: signupMethod === "email" ? "1.5px solid #e85a2a" : "1px solid #e0e0e0", background: signupMethod === "email" ? "#fff5f0" : "#fff", color: "#080808", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Email</button>
                  <button type="button" onClick={() => setSignupMethod("mobile")} style={{ padding: "8px 16px", borderRadius: 8, border: signupMethod === "mobile" ? "1.5px solid #e85a2a" : "1px solid #e0e0e0", background: signupMethod === "mobile" ? "#fff5f0" : "#fff", color: "#080808", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Mobile Number</button>
                </div>
              </div>
              {signupMethod === "mobile" ? (
                <div className="lf">
                  <label>Mobile Number</label>
                  <input className="fi" type="tel" placeholder="98765 43210" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>No OTP — you'll sign in with this number and your password. It isn't verified yet.</div>
                </div>
              ) : (
                <div className="lf">
                  <label>Email</label>
                  <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>
              )}
              <div className="lf"><label>Personal Email (backup)</label><input className="fi" type="email" placeholder="backup@gmail.com" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></div>
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
