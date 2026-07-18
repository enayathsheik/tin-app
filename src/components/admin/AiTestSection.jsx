import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDocs, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "../../firebase/config";

const confirmSuggestedAction = httpsCallable(functions, "confirmSuggestedAction");
const dismissSuggestedAction = httpsCallable(functions, "dismissSuggestedAction");

// Dev-only test harness for the AI Foundation Layer loop:
// seed 2 orgs -> conversation -> post a message -> review suggestedActions.
// Admin-only, reached via AdminDashboard's "Suggest Edits" nav item.
export function AiTestSection() {
  const uid = auth.currentUser?.uid;

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadConversations = async () => {
    const snap = await getDocs(collection(db, "conversations"));
    setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadConversations(); }, []);

  const loadThread = async (conversationId) => {
    setActiveConvId(conversationId);
    const [msgSnap, sugSnap] = await Promise.all([
      getDocs(query(collection(db, "messages"), where("conversationId", "==", conversationId), orderBy("createdAt", "asc"))),
      getDocs(query(collection(db, "suggestedActions"), where("conversationId", "==", conversationId), where("status", "==", "pending"))),
    ]);
    setMessages(msgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setSuggestions(sugSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const seedDemoOrgs = async () => {
    if (!uid) return alert("Not logged in.");
    setLoading(true);
    try {
      const org1 = await addDoc(collection(db, "organizations"), { name: "Demo Buyer Co.", type: "buyer", createdAt: serverTimestamp() });
      const org2 = await addDoc(collection(db, "organizations"), { name: "Demo Supplier Co.", type: "supplier", createdAt: serverTimestamp() });
      await Promise.all([
        addDoc(collection(db, "organizationMemberships"), { uid, orgId: org1.id, createdAt: serverTimestamp() }),
        addDoc(collection(db, "organizationMemberships"), { uid, orgId: org2.id, createdAt: serverTimestamp() }),
      ]);
      const conv = await addDoc(collection(db, "conversations"), {
        participantOrgIds: [org1.id, org2.id],
        participantUids: [uid],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      });
      await loadConversations();
      await loadThread(conv.id);
    } catch (e) { alert("Seed failed: " + e.message); }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConvId) return;
    setLoading(true);
    try {
      const conv = conversations.find(c => c.id === activeConvId);
      await addDoc(collection(db, "messages"), {
        conversationId: activeConvId,
        senderUid: uid,
        senderOrgId: conv?.participantOrgIds?.[0] || null,
        text: messageText.trim(),
        createdAt: serverTimestamp(),
      });
      setMessageText("");
      await loadThread(activeConvId);
    } catch (e) { alert("Send failed: " + e.message); }
    setLoading(false);
  };

  const handleConfirm = async (actionId) => {
    setBusyId(actionId);
    try {
      await confirmSuggestedAction({ actionId });
      setSuggestions(s => s.filter(x => x.id !== actionId));
    } catch (e) { alert("Confirm failed: " + e.message); }
    setBusyId(null);
  };

  const handleDismiss = async (actionId) => {
    setBusyId(actionId);
    try {
      await dismissSuggestedAction({ actionId });
      setSuggestions(s => s.filter(x => x.id !== actionId));
    } catch (e) { alert("Dismiss failed: " + e.message); }
    setBusyId(null);
  };

  return (
    <div>
      <div className="admin-hd">
        <div className="admin-title">AI Foundation — Test Loop</div>
        <div className="admin-sub">Dev-only: create a conversation, post a message, review suggested actions</div>
      </div>

      <button className="btn-sm btn-ok" disabled={loading} onClick={seedDemoOrgs} style={{ marginBottom: 16 }}>
        + Seed Demo Orgs &amp; Conversation
      </button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {conversations.map(c => (
          <button
            key={c.id}
            className={activeConvId === c.id ? "btn-sm btn-ok" : "btn-sm btn-out"}
            onClick={() => loadThread(c.id)}
          >
            {c.id.slice(0, 6)}…
          </button>
        ))}
      </div>

      {activeConvId && (
        <>
          <div style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 12, marginBottom: 12, maxHeight: 220, overflowY: "auto" }}>
            {messages.length === 0
              ? <div style={{ color: "var(--t3)", fontSize: 13 }}>No messages yet.</div>
              : messages.map(m => (
                <div key={m.id} style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "var(--t3)" }}>{m.senderUid?.slice(0, 6)}:</span> {m.text}
                </div>
              ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a test message…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--b2)" }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button className="btn-sm btn-ok" disabled={loading || !messageText.trim()} onClick={sendMessage}>Send</button>
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)", marginBottom: 10 }}>
            Pending Suggested Actions ({suggestions.length})
          </div>
          {suggestions.length === 0 ? (
            <div className="val-ok-banner"><span>✓</span><div>No pending suggestions for this conversation.</div></div>
          ) : (
            suggestions.map(s => (
              <div key={s.id} style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--rl)", padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{s.actionType}</div>
                <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{s.explanation?.reasoning}</div>
                <pre style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, whiteSpace: "pre-wrap" }}>{JSON.stringify(s.payload, null, 2)}</pre>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="btn-sm btn-ok" disabled={busyId === s.id} onClick={() => handleConfirm(s.id)}>✓ Confirm</button>
                  <button className="btn-sm" style={{ background: "var(--danger)15", color: "var(--danger)", border: "1px solid var(--danger)25", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }} disabled={busyId === s.id} onClick={() => handleDismiss(s.id)}>✕ Dismiss</button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
