import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { subscribeToConversation, linkEntity } from "../../lib/conversations";

// Renderers only for entity types with a real collection + page in TIN
// today. Anything else (e.g. "project") falls through to a neutral labelled
// chip below — no renderer, no read against a collection that doesn't exist
// yet. Add a richer renderer here per type as ledger/milestones/snags/
// projects land in later phases; that rich rail is explicitly NOT built now.
const ENTITY_RENDERERS = {
  store: { collection: "stores", label: (d) => d.storeName || "Store", route: (id) => `/store/${id}` },
  job: { collection: "jobListings", label: (d) => d.jobTitle || "Job", route: (id) => `/jobs/${id}` },
};

export function ContextRail({ conversationId }) {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [resolved, setResolved] = useState({});
  const [showLinkForm, setShowLinkForm] = useState(false);

  useEffect(() => {
    setConversation(null);
    const unsubscribe = subscribeToConversation({
      conversationId,
      onChange: setConversation,
      onError: (e) => console.error("[rail] conversation load failed:", e.message),
    });
    return () => unsubscribe();
  }, [conversationId]);

  const linkedEntities = conversation?.linkedEntities || [];
  const entityKey = linkedEntities.map(le => `${le.entityType}:${le.entityId}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const toResolve = linkedEntities.filter(le => ENTITY_RENDERERS[le.entityType]);
    if (!toResolve.length) { setResolved({}); return; }
    Promise.all(toResolve.map(async (le) => {
      const cfg = ENTITY_RENDERERS[le.entityType];
      try {
        const snap = await getDoc(doc(db, cfg.collection, le.entityId));
        return [le.entityId, snap.exists() ? { ok: true, label: cfg.label(snap.data()), route: cfg.route(le.entityId) } : { ok: false }];
      } catch {
        return [le.entityId, { ok: false }];
      }
    })).then(entries => { if (!cancelled) setResolved(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
    // entityKey (not linkedEntities) is the real dependency — same set of ids = no refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, color: "#080808", textTransform: "uppercase", letterSpacing: ".06em" }}>Linked Context</div>
        <button
          onClick={() => setShowLinkForm(s => !s)}
          style={{ padding: "4px 10px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {showLinkForm ? "Cancel" : "+ Link"}
        </button>
      </div>

      {showLinkForm && <LinkEntityForm conversationId={conversationId} onLinked={() => setShowLinkForm(false)} />}

      {linkedEntities.length === 0 && (
        <div style={{ color: "#888", fontSize: 12, textAlign: "center", padding: "24px 0" }}>No linked context yet.</div>
      )}

      {linkedEntities.map((le, i) => {
        const cfg = ENTITY_RENDERERS[le.entityType];
        const key = `${le.entityType}-${le.entityId}-${i}`;

        if (!cfg) {
          // Neutral slot for entity types with no renderer yet (e.g. "project").
          return (
            <div key={key} style={{ padding: "8px 10px", borderRadius: 10, background: "#f5f5f5", border: "1px dashed #ccc", fontSize: 12, color: "#888" }}>
              <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{le.entityType}</span> linked{le.relationship ? ` · ${le.relationship}` : ""}
            </div>
          );
        }

        const info = resolved[le.entityId];
        return (
          <div
            key={key}
            onClick={() => info?.ok && navigate(info.route)}
            style={{ padding: "8px 10px", borderRadius: 10, background: "#fff8f5", border: "1px solid #fde0d0", fontSize: 12, color: "#080808", cursor: info?.ok ? "pointer" : "default" }}
          >
            <span style={{ textTransform: "capitalize", fontWeight: 700, color: "#e85a2a" }}>{le.entityType}</span>{": "}
            {!info ? "Loading…" : info.ok ? info.label : "Unavailable"}
          </div>
        );
      })}
    </div>
  );
}

// Only offers entityTypes that exist in ENTITY_RENDERERS above — lib/conversations.js's
// linkEntity() enforces the same allowlist against the real collections, so
// this can't drift into linking a type with no renderer.
function LinkEntityForm({ conversationId, onLinked }) {
  const [entityType, setEntityType] = useState("store");
  const [entityId, setEntityId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!entityId.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await linkEntity({ conversationId, entityType, entityId, relationship });
      setEntityId("");
      setRelationship("");
      onLinked?.();
    } catch (e) {
      setError(e.message || "Failed to link.");
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: 10, borderRadius: 10, background: "#f8f8f8", border: "1px solid #e0e0e0", display: "flex", flexDirection: "column", gap: 6 }}>
      <select value={entityType} onChange={e => setEntityType(e.target.value)} style={{ fontSize: 12, borderRadius: 6, border: "1px solid #e0e0e0", padding: "5px 6px" }}>
        <option value="store">Store</option>
        <option value="job">Job</option>
      </select>
      <input className="fi" value={entityId} onChange={e => setEntityId(e.target.value)} placeholder={`${entityType === "store" ? "Store" : "Job"} ID (from its page URL)`} style={{ fontSize: 12 }} />
      <input className="fi" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Relationship (optional)" style={{ fontSize: 12 }} />
      {error && <div style={{ color: "#dc2626", fontSize: 11 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={saving || !entityId.trim()}
        style={{ padding: "6px 0", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving || !entityId.trim() ? 0.6 : 1 }}
      >
        {saving ? "Linking…" : "Link"}
      </button>
    </div>
  );
}
