import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/config";
import { getOrCreateDirectConversation, createGroupConversation } from "../../lib/conversations";

// Roster comes straight from memberships (orgId + status active) rather than
// users/{uid} — users/{uid} is self-read-only in firestore.rules, so
// displayName has to already be denormalized onto the membership doc (see
// tenancy.js createMembership). This modal itself is only reachable by
// owner/admin/manager (gated in ConversationsPage) because the memberships
// list-read rule only lets those roles query for anyone but themselves —
// a plain "member" role can't enumerate the roster to start a new thread.
export function NewConversationModal({ user, orgCtx, onClose, onCreated }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("direct"); // "direct" | "group"
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, "memberships"), where("orgId", "==", orgCtx.orgId), where("status", "==", "active")))
      .then(snap => {
        if (cancelled) return;
        setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.uid !== user.uid));
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgCtx.orgId, user.uid]);

  const toggleSelect = (uid) => {
    if (mode === "direct") { setSelected([uid]); return; }
    setSelected(sel => sel.includes(uid) ? sel.filter(u => u !== uid) : [...sel, uid]);
  };

  const buildNames = (uids) => {
    const names = { [user.uid]: user.name || user.email || "Me" };
    uids.forEach(uid => {
      const member = roster.find(r => r.uid === uid);
      if (member) names[uid] = member.displayName || uid;
    });
    return names;
  };

  const handleCreate = async () => {
    if (!selected.length || creating) return;
    setCreating(true);
    setError(null);
    try {
      const conv = mode === "direct"
        ? await getOrCreateDirectConversation({ orgId: orgCtx.orgId, currentUid: user.uid, otherUid: selected[0], names: buildNames(selected) })
        : await createGroupConversation({ orgId: orgCtx.orgId, currentUid: user.uid, participantUids: selected, names: buildNames(selected) });
      onCreated(conv.id);
    } catch (e) {
      setError(e.message || "Failed to start conversation.");
    }
    setCreating(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000060", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 18, color: "#080808" }}>New Conversation</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["direct", "Direct"], ["group", "Group"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setMode(id); setSelected([]); }}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: mode === id ? "1px solid #e85a2a" : "1px solid #e0e0e0", background: mode === id ? "#fff3ef" : "#fff", color: mode === id ? "#e85a2a" : "#080808", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, minHeight: 120 }}>
          {loading && <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>Loading members…</div>}
          {error && <div style={{ padding: 16, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error}</div>}
          {!loading && !error && roster.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>No other members in your organization yet.</div>
          )}
          {roster.map(m => {
            const isSelected = selected.includes(m.uid);
            return (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.uid)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, cursor: "pointer", background: isSelected ? "#fff3ef" : "transparent" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e85a2a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {(m.displayName || m.uid).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: "#080808" }}>{m.displayName || m.uid}</div>
                <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>{m.role}</div>
                {isSelected && <span style={{ color: "#e85a2a" }}>✓</span>}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleCreate}
          disabled={!selected.length || creating}
          style={{ padding: "9px 0", borderRadius: 10, background: "#e85a2a", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: !selected.length || creating ? "default" : "pointer", opacity: !selected.length || creating ? 0.6 : 1 }}
        >
          {creating ? "Starting…" : mode === "direct" ? "Start conversation" : `Start group (${selected.length})`}
        </button>
      </div>
    </div>
  );
}
