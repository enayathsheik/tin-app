// HOM Systems — login/signup gate (Block 5). Browsing and cabinet-building
// on the microsite stay fully anonymous (see HomSystemsPage.jsx — this
// component is never mounted until "Place Order" is clicked with no
// signed-in user); this is the ONLY point on the microsite that requires a
// TIN account. It drives the exact same account-creation pipeline as
// src/pages/LoginPage.jsx — normalise-to-synthetic-email for mobile (see
// src/utils/phoneAuth.js), createUserWithEmailAndPassword /
// signInWithEmailAndPassword, claimHandle, saveUserProfile — just with a
// faster, role-less checkout UI: no role picker (every HOM signup is role
// "consumer") and no manual handle step (auto-assigned via
// findAvailableHandle, exactly like LoginPage's own auto-suggestion), since
// a furniture buyer mid-checkout has no reason to care about either. Import
// paths reach up to src/utils and src/firebase — this file lives under
// src/pages/hom/ same as its siblings.
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, saveUserProfile, getUserProfile } from "../../firebase/config";
import { claimHandle, findAvailableHandle, suggestHandleBase } from "../../utils/handles";
import { normalizeIndianMobile, phoneToSyntheticEmail, resolveAuthEmail } from "../../utils/phoneAuth";
import { getLevel } from "../../utils/helpers";

function mapAuthError(err, isPhoneAttempt) {
  return err.message
    .replace("Firebase: ", "")
    .replace("(auth/email-already-in-use)", isPhoneAttempt ? "That mobile number is already registered — please sign in instead." : "That email is already registered — please sign in instead.")
    .replace("(auth/wrong-password)", "Wrong password.")
    .replace("(auth/user-not-found)", isPhoneAttempt ? "No account found for this mobile number — please create one." : "No account found for this email — please create one.")
    .replace("(auth/invalid-credential)", isPhoneAttempt ? "Invalid mobile number or password." : "Invalid email or password.")
    .replace("(auth/weak-password)", "Password must be at least 6 characters.");
}

export function HomAuthGate({ onAuthed, onCancel }) {
  const [mode, setMode] = useState("login"); // login | register
  const [signupMethod, setSignupMethod] = useState("mobile"); // mobile | email — mobile-first here, the HOM customer base skews to phone
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState(""); // login: email or mobile, in one field
  const [mobile, setMobile] = useState(""); // register: mobile-only field
  const [email, setEmail] = useState(""); // register: email-only field
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    const passToUse = pass.trim();
    if (!passToUse) { setError("Enter your password."); return; }

    if (mode === "login") {
      const resolved = resolveAuthEmail(identifier);
      if (resolved.error) { setError(resolved.error); return; }
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, resolved.email, passToUse);
        const profile = await getUserProfile(cred.user.uid);
        onAuthed(profile ? { ...profile, uid: cred.user.uid } : { uid: cred.user.uid, name: resolved.isPhone ? resolved.phone : resolved.email.split("@")[0], phone: resolved.phone || null, email: resolved.email });
      } catch (err) {
        setError(mapAuthError(err, resolved.isPhone));
      }
      setLoading(false);
      return;
    }

    // REGISTER — role is always "consumer" here; see file header.
    let emailToUse;
    let phoneDigits = null;
    if (signupMethod === "mobile") {
      const digits = normalizeIndianMobile(mobile);
      if (!digits) { setError("Enter a valid 10-digit mobile number."); return; }
      phoneDigits = digits;
      emailToUse = phoneToSyntheticEmail(digits);
    } else {
      emailToUse = email.trim();
      if (!emailToUse) { setError("Enter your email."); return; }
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailToUse, passToUse);
      const displayName = name.trim() || emailToUse.split("@")[0];
      const ud = {
        name: displayName,
        email: emailToUse,
        phone: phoneDigits,
        workEmail: emailToUse,
        personalEmail: "",
        role: "consumer",
        linkedin: "",
        company: "",
        points: 0,
        storesAdded: 0,
        citiesCovered: 0,
        level: getLevel(0).name,
        validationStatus: "n/a",
        referralCode: "TIN" + displayName.replace(/[^A-Z0-9]/gi, "").substring(0, 5).toUpperCase() + Math.floor(Math.random() * 900 + 100),
        referredBy: null,
        createdAt: new Date().toISOString(),
        uid: cred.user.uid,
      };
      try {
        const handle = await findAvailableHandle(suggestHandleBase(displayName));
        await claimHandle(cred.user.uid, handle, { role: ud.role, displayName, city: "", photoUrl: null, points: 0, storesAdded: 0, specialization: "", categories: [] });
        ud.handle = handle;
      } catch (handleErr) {
        console.error("[hom-auth-gate] Handle claim failed:", handleErr);
      }
      await saveUserProfile(cred.user.uid, ud);
      onAuthed(ud);
    } catch (err) {
      setError(mapAuthError(err, signupMethod === "mobile"));
    }
    setLoading(false);
  };

  return (
    <div className="hm-chit-overlay" onClick={onCancel}>
      <div className="hm-chit-paper" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <button className="hm-chit-close hm-btn hm-btn-ghost hm-btn-sm" onClick={onCancel}>Close</button>
        <div className="hm-plate-title" style={{ marginBottom: 4 }}>{mode === "login" ? "Sign in to place your order" : "Create an account to place your order"}</div>
        <div className="hm-section-sub" style={{ marginBottom: 16 }}>Browsing and building your cabinet list never needed an account — placing the order does.</div>

        {mode === "register" && (
          <div className="hm-field" style={{ marginBottom: 12 }}>
            <div className="hm-field-label">Name</div>
            <input className="hm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
        )}

        {mode === "register" && (
          <div className="hm-field" style={{ marginBottom: 12 }}>
            <div className="hm-field-label">Sign up with</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <div className={`hm-chip ${signupMethod === "mobile" ? "on" : ""}`} onClick={() => setSignupMethod("mobile")}>Mobile Number</div>
              <div className={`hm-chip ${signupMethod === "email" ? "on" : ""}`} onClick={() => setSignupMethod("email")}>Email</div>
            </div>
          </div>
        )}

        {mode === "login" ? (
          <div className="hm-field" style={{ marginBottom: 12 }}>
            <div className="hm-field-label">Email or Mobile Number</div>
            <input className="hm-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or 98765 43210" />
          </div>
        ) : signupMethod === "mobile" ? (
          <div className="hm-field" style={{ marginBottom: 12 }}>
            <div className="hm-field-label">Mobile Number</div>
            <input className="hm-input" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))} placeholder="98765 43210" />
            <div style={{ fontSize: 11, color: "var(--hm-sub)", marginTop: 4 }}>No OTP — you'll sign in with this number and your password. It isn't verified yet.</div>
          </div>
        ) : (
          <div className="hm-field" style={{ marginBottom: 12 }}>
            <div className="hm-field-label">Email</div>
            <input className="hm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        )}

        <div className="hm-field" style={{ marginBottom: 14 }}>
          <div className="hm-field-label">Password</div>
          <input className="hm-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>

        {error && <div className="hm-field-err" style={{ marginBottom: 12 }}>{error}</div>}

        <button className="hm-btn hm-btn-acc" style={{ width: "100%" }} disabled={loading} onClick={submit}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In & Continue →" : "Create Account & Continue →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}>
          {mode === "login"
            ? <>New here? <span style={{ color: "var(--hm-acc)", fontWeight: 700, cursor: "pointer" }} onClick={() => { setMode("register"); setError(""); }}>Create an account</span></>
            : <>Already have an account? <span style={{ color: "var(--hm-acc)", fontWeight: 700, cursor: "pointer" }} onClick={() => { setMode("login"); setError(""); }}>Sign in</span></>
          }
        </div>
      </div>
    </div>
  );
}
