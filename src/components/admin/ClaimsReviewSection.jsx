// L2b: admin review of "Find your business" claims. Approving links the store
// to the claimant's account and hands it to them (src/lib/storeClaims.js
// approveClaim) — it does NOT verify the account; that stays a separate step
// in User Management.
import { useEffect, useState } from "react";
import { approveClaim, loadClaimsForReview, rejectClaim } from "../../lib/storeClaims";

const fmt = (ts) => ts?.toDate?.()?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) || "—";
const row = { display: "flex", gap: 8, fontSize: 13, marginBottom: 4 };
const lbl = { width: 130, flexShrink: 0, color: "var(--t3)" };

export function ClaimsReviewSection({ user }) {
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState({ key: null, claims: [] });
  const loadKey = `${status}:${reloadKey}`;
  const claims = loaded.key === loadKey ? loaded.claims : null;

  useEffect(() => {
    let cancelled = false;
    loadClaimsForReview(status)
      .then(list => { if (!cancelled) setLoaded({ key: loadKey, claims: list }); })
      .catch(e => {
        console.error("[claims] load failed:", e);
        if (!cancelled) { setError("Claims couldn't be loaded."); setLoaded({ key: loadKey, claims: [] }); }
      });
    return () => { cancelled = true; };
  }, [status, loadKey]);

  const act = async (claim, kind) => {
    setBusy(claim.id); setError("");
    try {
      if (kind === "approve") await approveClaim(claim, user?.uid);
      else await rejectClaim(claim, user?.uid);
      setReloadKey(k => k + 1);
    } catch (e) {
      console.error("[claims] action failed:", e);
      setError(e.message || "That didn't work.");
    }
    setBusy(null);
  };

  return (
    <>
      <div className="admin-hd">
        <div className="admin-title">Business Claims</div>
        <div className="admin-sub">Owners claiming a business listed on TIN. Approving links the business to their account. It does not verify the account — do that separately in User Management.</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["pending", "approved", "rejected"].map(s => (
          <button key={s} type="button" onClick={() => { setStatus(s); setError(""); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--b2)", background: status === s ? "var(--acc)" : "#fff", color: status === s ? "#fff" : "var(--t1)", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>}
      {claims === null && <div style={{ color: "var(--t3)" }}>Loading…</div>}
      {claims?.length === 0 && <div className="val-ok-banner"><span>✓</span><div>No {status} claims.</div></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {claims?.map(c => {
          const legacy = !c.claimantUid;
          const takenByOther = c.store?.claimedByUid && c.store.claimedByUid !== c.claimantUid;
          const otherLink = c.claimant?.storeId && c.claimant.storeId !== c.storeId;
          return (
            <div key={c.id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{c.storeName || c.store?.storeName || "(unknown store)"}</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>
                {[c.store?.businessType, c.store?.address, c.store?.city || c.storeCity].filter(Boolean).join(" · ")}
                {c.storeId && <> · <a href={`/store/${c.storeId}`} target="_blank" rel="noreferrer">store page</a></>}
                {c.store?.source === "bulk_upload" && " · imported"}
                {c.store?.verificationStatus === "verified" && " · verified store"}
              </div>
              <div style={row}><span style={lbl}>Claimant</span><span>{c.name || "—"}{c.claimant?.name && c.claimant.name !== c.name ? ` (account: ${c.claimant.name})` : ""}</span></div>
              <div style={row}><span style={lbl}>Mobile</span><span>{c.phone ? <a href={`tel:+91${c.phone}`}>{c.phone}</a> : "—"}{c.phoneConfirmed ? " · confirmed by claimant" : " · not confirmed"}</span></div>
              <div style={row}><span style={lbl}>GST</span><span>{c.gst || "Not given"}</span></div>
              <div style={row}><span style={lbl}>Email</span><span>{c.email || c.claimant?.email || "—"}</span></div>
              <div style={row}><span style={lbl}>Store phone</span><span>{c.store?.phone || "—"}{c.store?.gst ? ` · store GST ${c.store.gst}` : ""}</span></div>
              <div style={row}><span style={lbl}>Account verified</span><span>{c.claimant?.verificationStatus === "verified" ? "Yes" : "No"}</span></div>
              <div style={row}><span style={lbl}>Sent</span><span>{fmt(c.createdAt)}</span></div>
              {c.reviewedAt && <div style={row}><span style={lbl}>Reviewed</span><span>{fmt(c.reviewedAt)}</span></div>}
              {legacy && <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>Old claim from before accounts were recorded — it can only be rejected. Contact the person directly.</div>}
              {takenByOther && <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>This store is already claimed by another account.</div>}
              {otherLink && <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>This account is already linked to another store ({c.claimant.storeId}). Approving moves the link to this store.</div>}
              {status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="button" disabled={busy === c.id || legacy || takenByOther} onClick={() => act(c, "approve")}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: legacy || takenByOther ? "#ccc" : "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Approve</button>
                  <button type="button" disabled={busy === c.id} onClick={() => act(c, "reject")}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
