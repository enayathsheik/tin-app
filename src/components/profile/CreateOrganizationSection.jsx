import { useState, useEffect } from "react";
import { resolveActiveOrg, createOrganization } from "../../lib/tenancy";

// Minimal org-creation entry point. Since Phase 1 made solo-org bootstrap
// opt-in (no longer automatic on login), this is now the ONLY way a user
// can create an organization at all — without it, createOrganization in
// lib/tenancy.js is unreachable from the product. Not a full workspace
// switcher/onboarding flow — just enough to create one org + become its
// owner, matching what the old automatic bootstrap used to produce.
export function CreateOrganizationSection({ user }) {
  const [orgCtx, setOrgCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    resolveActiveOrg(user.uid).then(setOrgCtx).finally(() => setLoading(false));
  }, [user?.uid]);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createOrganization({ name: name.trim(), type: "org" });
      setOrgCtx({ orgId: created.orgId, org: created.org, membership: created.membership, memberships: [created.membership] });
      setName("");
    } catch (e) {
      setError(e.message || "Failed to create organization.");
    }
    setCreating(false);
  };

  if (loading) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
        Organization
      </div>
      {orgCtx ? (
        <div style={{ fontSize: 13, color: "#080808" }}>
          You're the <strong style={{ textTransform: "capitalize" }}>{orgCtx.membership?.role}</strong> of{" "}
          <strong>{orgCtx.org?.name || orgCtx.orgId}</strong>.
        </div>
      ) : (
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
            You're not part of an organization yet. Your personal messages and profile work fine without one —
            create one if you want a team workspace (member roles, org-wide conversations).
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Organization name"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: creating || !name.trim() ? "default" : "pointer", opacity: creating || !name.trim() ? 0.6 : 1, whiteSpace: "nowrap" }}
            >
              {creating ? "Creating…" : "Create Organization"}
            </button>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
