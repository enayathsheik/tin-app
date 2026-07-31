import { useState, useEffect, useRef, useMemo } from "react";
import {
  subscribeToThread, fetchOlderMessages, subscribeToSuggestedActions, subscribeToConversation,
  conversationTitle, acceptPersonalConversation,
} from "../../lib/conversations";
import { MessageItem } from "./MessageItem";
import { MessageComposer } from "./MessageComposer";
import { SuggestedActionChip } from "./SuggestedActionChip";

const LIVE_PAGE_SIZE = 50;

// Realtime, scoped to exactly the open conversation — subscribeToThread is
// re-subscribed (and the previous listener detached) whenever conversationId
// changes, and detached on unmount. Never left open against a closed thread.
export function MessageThread({ user, orgCtx, conversationId, onBack, onOpenContext }) {
  const [conversation, setConversation] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveDocs, setLiveDocs] = useState([]);
  const [history, setHistory] = useState({ messages: [], docs: [] });
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [accepting, setAccepting] = useState(false);
  const scrollRef = useRef(null);
  const didInitialScroll = useRef(false);
  const pendingScrollAdjust = useRef(null);

  // Live (not one-time) so an accept from the other tab/party is reflected
  // immediately — the accept banner and composer lock both depend on it.
  useEffect(() => {
    const unsubscribe = subscribeToConversation({
      conversationId,
      onChange: setConversation,
      onError: (e) => console.error("[thread] conversation load failed:", e.message),
    });
    return () => unsubscribe();
  }, [conversationId]);

  // Pre-accept one-way gate (firestore.rules canCreateMessage/canUpdatePersonalConversation
  // enforce this too — these are the matching client-side affordances, not
  // the source of truth).
  const isPendingRequest = conversation?.context === "personal"
    && conversation?.type === "direct"
    && conversation?.status === "requested";
  const isRecipient = isPendingRequest && conversation.createdBy !== user.uid;
  const isInitiatorWaiting = isPendingRequest && conversation.createdBy === user.uid;

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      await acceptPersonalConversation({ conversationId });
    } catch (e) {
      console.error("[thread] accept failed:", e.message);
    }
    setAccepting(false);
  };

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

  useEffect(() => {
    setSuggestedActions([]);
    const unsubscribe = subscribeToSuggestedActions({
      conversationId,
      onChange: setSuggestedActions,
      onError: (e) => console.error("[thread] suggestedActions load failed:", e.message),
    });
    return () => unsubscribe();
  }, [conversationId]);

  const actionsByMessageId = useMemo(() => {
    const map = {};
    for (const action of suggestedActions) {
      (map[action.messageId] ||= []).push(action);
    }
    return map;
  }, [suggestedActions]);

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
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 16, color: "#080808", flex: 1 }}>
          {conversation ? conversationTitle(conversation, user.uid) : "Conversation"}
        </div>
        {onOpenContext && (
          <button onClick={onOpenContext} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#080808" }} aria-label="View linked context">ℹ️</button>
        )}
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
        {allMessages.map(m => {
          const isOwn = m.senderUid === user.uid;
          return (
            <div key={m.id}>
              <MessageItem message={m} isOwn={isOwn} />
              {(actionsByMessageId[m.id] || []).map(action => (
                <SuggestedActionChip key={action.id} action={action} isOwn={isOwn} />
              ))}
            </div>
          );
        })}
      </div>

      {isRecipient && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderTop: "1px solid #e0e0e0", background: "#fff3ef", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#080808" }}>
            {conversationTitle(conversation, user.uid)} wants to message you.
          </div>
          <button onClick={handleAccept} disabled={accepting} style={{ padding: "6px 14px", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: accepting ? "default" : "pointer", opacity: accepting ? 0.6 : 1, flexShrink: 0 }}>
            {accepting ? "…" : "Accept"}
          </button>
        </div>
      )}
      {isInitiatorWaiting && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e0e0e0", background: "#f5f5f5", color: "#888", fontSize: 11, textAlign: "center", flexShrink: 0 }}>
          Waiting for them to accept before they can reply.
        </div>
      )}

      {isRecipient
        ? <div style={{ borderTop: "1px solid #e0e0e0", background: "#fff", padding: 14, textAlign: "center", color: "#888", fontSize: 12, flexShrink: 0 }}>Accept the request to reply.</div>
        : (
          <MessageComposer
            conversationId={conversationId}
            orgId={orgCtx?.orgId ?? null}
            senderUid={user.uid}
            senderOrgId={orgCtx?.orgId ?? null}
          />
        )}
    </div>
  );
}
