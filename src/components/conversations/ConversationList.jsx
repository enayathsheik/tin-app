import { useState, useEffect, useCallback } from "react";
import {
  fetchConversationPage, getConversationMeta, conversationTitle,
} from "../../lib/conversations";

const PAGE_SIZE = 20;

function formatWhen(ts) {
  const date = ts?.toDate?.();
  if (!date) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Tenant + participant scoped, paginated conversation list. Joins the
// per-user conversationMeta doc (label/pin/mute) for each row shown —
// bounded to the page size, never an unbounded read.
export function ConversationList({ user, orgCtx, onOpen, activeId = null, onNewConversation, canStartConversation = false }) {
  const [conversations, setConversations] = useState([]);
  const [metaByCid, setMetaByCid] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const loadMetaFor = useCallback(async (convs) => {
    const entries = await Promise.all(
      convs.map(async (c) => [c.id, await getConversationMeta(user.uid, c.id).catch(() => null)])
    );
    setMetaByCid(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  }, [user.uid]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchConversationPage({ orgId: orgCtx.orgId, uid: user.uid, pageSize: PAGE_SIZE })
      .then(({ conversations: page, lastDoc, hasMore: more }) => {
        if (cancelled) return;
        setConversations(page);
        setCursor(lastDoc);
        setHasMore(more);
        loadMetaFor(page);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgCtx.orgId, user.uid, loadMetaFor]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { conversations: page, lastDoc, hasMore: more } = await fetchConversationPage({
        orgId: orgCtx.orgId, uid: user.uid, pageSize: PAGE_SIZE, cursor,
      });
      setConversations(prev => [...prev, ...page]);
      setCursor(lastDoc);
      setHasMore(more);
      loadMetaFor(page);
    } catch (e) {
      setError(e.message);
    }
    setLoadingMore(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 18, color: "#080808" }}>Messages</div>
        {canStartConversation && (
          <button onClick={onNewConversation} style={{ padding: "6px 12px", borderRadius: 8, background: "#e85a2a", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ New</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <div style={{ padding: 20, color: "#888", fontSize: 13, textAlign: "center" }}>Loading…</div>}
        {error && <div style={{ padding: 20, color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</div>}
        {!loading && !error && conversations.length === 0 && (
          <div style={{ padding: "40px 20px", color: "#888", fontSize: 13, textAlign: "center" }}>
            No conversations yet.{canStartConversation ? " Start one to get going." : ""}
          </div>
        )}
        {conversations.map(conv => {
          const meta = metaByCid[conv.id];
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              onClick={() => onOpen(conv.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                background: isActive ? "#fff3ef" : "transparent",
                opacity: meta?.muted ? 0.6 : 1,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e85a2a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {conversationTitle(conv, user.uid).charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#080808", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {meta?.label || conversationTitle(conv, user.uid)}
                  </div>
                  {meta?.pinned && <span style={{ fontSize: 10 }}>📌</span>}
                </div>
                <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>{conv.type} · {conv.scope}</div>
              </div>
              <div style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>{formatWhen(conv.lastMessageAt)}</div>
            </div>
          );
        })}
        {hasMore && (
          <div style={{ padding: 14, textAlign: "center" }}>
            <button onClick={loadMore} disabled={loadingMore} style={{ padding: "7px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
