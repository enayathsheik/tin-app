import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { searchUsers } from "../../lib/userSearch";

const createExternalConversationFn = httpsCallable(functions, "createExternalConversation");

// Matches PublicProfilePage's ROLE_LABELS — profile.role is already the
// public role (see src/utils/handles.js publicRoleFromInternalRole).
const ROLE_LABELS = {
  consumer: "Consumer",
  marketChampion: "Market Champion",
  retailer: "Retailer / Distributor",
  architect: "Architect / Designer",
  contractor: "Contractor",
};

const SEARCH_DEBOUNCE_MS = 300;

// Global "start a chat with anyone on TIN" search — the WhatsApp-style
// primary entry point into Conversations. Searches only the sanitized
// public profiles/{uid} shape (src/lib/userSearch.js); starting the chat
// goes through the already-deployed createExternalConversation callable,
// which enforces its own org/participant checks on the Admin SDK side.
export function UserSearchModal({ user, onClose, onCreated }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startingUid, setStartingUid] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = term.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      searchUsers(q, { excludeUid: user.uid })
        .then(r => setResults(r))
        .catch(e => setError(e.message || "Search failed."))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [term, user.uid]);

  const handleSelect = async (profile) => {
    if (startingUid) return;
    setStartingUid(profile.uid);
    setError(null);
    try {
      const { data } = await createExternalConversationFn({ counterpartyUid: profile.uid });
      onCreated(data.conversationId);
    } catch (e) {
      setError(e.message || "Couldn't start a conversation with this person.");
      setStartingUid(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000060", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 18, color: "#080808" }}>New chat</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888" }}>✕</button>
        </div>

        <input
          autoFocus
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Search by name or @handle"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e0", fontSize: 13, marginBottom: 12, outline: "none" }}
        />

        <div style={{ flex: 1, overflowY: "auto", minHeight: 120 }}>
          {!term.trim() && (
            <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>Search for anyone on TIN by name or @handle.</div>
          )}
          {loading && <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>Searching…</div>}
          {error && <div style={{ padding: 16, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error}</div>}
          {!loading && !error && term.trim() && results.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>No users found.</div>
          )}
          {results.map(r => (
            <div
              key={r.uid}
              onClick={() => handleSelect(r)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, cursor: startingUid ? "default" : "pointer", opacity: startingUid && startingUid !== r.uid ? 0.5 : 1 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e85a2a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, overflow: "hidden" }}>
                {r.photoUrl
                  ? <img src={r.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (r.displayName || r.handle || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#080808", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.displayName || `@${r.handle}`}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  @{r.handle}{r.city ? ` · ${r.city}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#e85a2a", background: "#fff3ef", border: "1px solid #fde0d0", borderRadius: 10, padding: "3px 8px", flexShrink: 0 }}>
                {ROLE_LABELS[r.role] || r.role}
              </div>
              {startingUid === r.uid && <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>…</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
