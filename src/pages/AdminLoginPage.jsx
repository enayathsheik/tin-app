import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase/config";

export function AdminLoginPage({ onAdminLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ADMIN_EMAIL = "enayathsheik@gmail.com";

  const handleLogin = async () => {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        onAdminLogin({ name: "Admin", email, workEmail: email, personalEmail: email, role: "admin", points: 0, storesAdded: 0, citiesCovered: 0, validationStatus: "active", uid: cred.user.uid });
      } else {
        setError("Access denied. Admin credentials only.");
        await signOut(auth);
      }
    } catch(err) {
      setError("Invalid credentials.");
    }
    setLoading(false);
  };

  return (
    <div className="login-pg">
      <div className="login-card" style={{maxWidth:360}}>
        <div className="login-logo">Trade Intelligence Network</div>
        <div className="login-title"><em>Admin</em> Access</div>
        <div className="login-sub" style={{marginBottom:20}}>Restricted area. Authorized personnel only.</div>
        {error && <div style={{background:"var(--danger)10",border:"1px solid var(--danger)25",borderRadius:"var(--r)",padding:"10px 14px",fontSize:13,color:"var(--danger)",marginBottom:14}}>{error}</div>}
        <div className="login-fields">
          <div className="lf"><label>Admin Email</label><input className="fi" type="email" placeholder="admin@tin.in" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="lf"><label>Password</label><input className="fi" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
        </div>
        <button className="btn-login" onClick={handleLogin} disabled={loading}>{loading ? "Verifying..." : "Access Admin Panel →"}</button>
        <div className="login-sw"><a href="/" style={{color:"#080808",fontSize:12,textDecoration:"none"}}>← Back to TIN</a></div>
      </div>
    </div>
  );
}
