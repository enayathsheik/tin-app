import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { subscribeToThread, fetchOlderMessages, conversationTitle } from "../../lib/conversations";
import { MessageItem } from "./MessageItem";

const LIVE_PAGE_SIZE = 50;

// Realtime, scoped to exactly the open conversation — subscribeToThread is
// re-subscribed (and the previous listener detached) whenever conversationId
// changes, and detached on unmount. Never left open against a closed thread.
export function MessageThread({ user, conversationId, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveDocs, setLiveDocs] = useState([]);
  const [history, setHistory] = useState({ messages: [], docs: [] });
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const didInitialScroll = useRef(false);
  const pendingScrollAdjust = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "conversations", conversationId))
      .then(snap => { if (!cancelled && snap.exists()) setConversation({ id: snap.id, ...snap.data() }); })
      .catch(e => console.error("[thread] conversation load failed:", e.message));
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    setLiveMessages([]);
    setLiveDocs([]);
    setHistory({ messages: [], docs: [] });
    setNoMoreOlder(false);
    setError(null);
    didInitialScroll.current = false;

    const unsubscribe = subscribeToThread({
      conversationId,
      pageSize: LIVE_PAGE_SIZE,
      onChange: (messages, docs) => { setLiveMessages(messages); setLiveDocs(docs); },
      onError: (e) => setError(e.message),
    });
    return () => unsubscribe();
  }, [conversationId]);

  const allMessages = [...history.messages, ...liveMessages];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScrollAdjust.current != null) {
      el.scrollTop = el.scrollHeight - pendingScrollAdjust.current;
      pendingScrollAdjust.current = null;
      return;
    }
    el.scrollTop = el.scrollHeight;
    didInitialScroll.current = true;
  }, [allMessages.length]);

  const oldestCursorDoc = history.docs[0] || liveDocs[0] || null;
  const mightHaveOlder = history.messages.length > 0
    ? !noMoreOlder
    : liveMessages.length === LIVE_PAGE_SIZE;

  const loadOlder = async () => {
    if (!oldestCursorDoc || loadingOlder || noMoreOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    if (el) pendingScrollAdjust.current = el.scrollHeight - el.scrollTop;
    try {
      const { messages, docs, hasMore } = await fetchOlderMessages({ conversationId, beforeDoc: oldestCursorDoc });
      if (messages.length === 0) {
        setNoMoreOlder(true);
      } else {
        setHistory(h => ({ messages: [...messages, ...h.messages], docs: [...docs, ...h.docs] }));
        if (!hasMore) setNoMoreOlder(true);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoadingOlder(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #e0e0e0", background: "#fff", flexShrink: 0 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#080808" }} aria-label="Back to conversations">←</button>
        )}
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 16, color: "#080808" }}>
          {conversation ? conversationTitle(conversation, user.uid) : "Conversation"}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {mightHaveOlder && (
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <button onClick={loadOlder} disabled={loadingOlder} style={{ padding: "5px 12px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        {error && <div style={{ color: "#dc2626", fontSize: 12, textAlign: "center", marginBottom: 10 }}>{error}</div>}
        {allMessages.length === 0 && !error && (
          <div style={{ color: "#888", fontSize: 13, textAlign: "center", marginTop: 30 }}>No messages yet — say hello.</div>
        )}
        {allMessages.map(m => (
          <MessageItem key={m.id} message={m} isOwn={m.senderUid === user.uid} />
        ))}
      </div>
    </div>
  );
}
