import { useState, useEffect } from "react";
import { resolveActiveOrg, createMembership } from "../../lib/tenancy";

const ROLES = ["member", "manager", "admin"];

// Minimal member provisioning — NOT the full invite/onboarding flow. Given a
// known uid + role, adds them to the signed-in admin's own org so a real
// two-person conversation thread becomes testable. Requires the caller to
// already be owner/admin of that org (firestore.rules' memberships create
// rule) — no rule change needed since bootstrapOwnerOrg makes the platform
// admin an owner of their own org on login.
export function MemberProvisioningSection({ user }) {
  const [orgCtx, setOrgCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    resolveActiveOrg(user.uid).then(setOrgCtx).finally(() => setLoading(false));
  }, [user?.uid]);

  const handleSubmit = async () => {
    if (!uid.trim() || !orgCtx || saving) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      await createMembership({ orgId: orgCtx.orgId, uid: uid.trim(), role, displayName: displayName.trim() });
      setResult(`Added ${displayName.trim() || uid.trim()} as ${role}.`);
      setUid("");
      setDisplayName("");
    } catch (e) {
      setError(e.message || "Failed to add member.");
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="admin-hd">
        <div className="admin-title">Member Provisioning</div>
        <div className="admin-sub">Add a known uid to your organization with a role — makes a real two-person thread testable; not the full invite flow.</div>
      </div>

      {loading && <div style={{ padding: 20, color: "var(--t3)", fontSize: 13 }}>Loading your organization…</div>}
      {!loading && !orgCtx && (
        <div style={{ padding: 20, color: "var(--t3)", fontSize: 13 }}>You need to be an active owner/admin of an organization to provision members.</div>
      )}
      {!loading && orgCtx && (
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
            Organization: <strong style={{ color: "var(--t1)" }}>{orgCtx.org?.name || orgCtx.orgId}</strong> · your role: <strong style={{ color: "var(--t1)" }}>{orgCtx.membership?.role}</strong>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>User UID</div>
            <input className="fi" value={uid} onChange={e => setUid(e.target.value)} placeholder="Firebase Auth uid" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Display Name</div>
            <input className="fi" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Shown in the conversation picker" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Role</div>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--b3)", padding: "6px 8px", width: "100%" }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {result && <div style={{ color: "var(--ok)", fontSize: 12, marginBottom: 10 }}>{result}</div>}
          <button className="btn-sm btn-ok" onClick={handleSubmit} disabled={saving || !uid.trim()}>
            {saving ? "Adding…" : "Add Member"}
          </button>
        </div>
      )}
    </div>
  );
}
