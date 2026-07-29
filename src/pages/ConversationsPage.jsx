import { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { resolveActiveOrg } from "../lib/tenancy";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { ConversationList } from "../components/conversations/ConversationList";
import { MessageThread } from "../components/conversations/MessageThread";
import { NewConversationModal } from "../components/conversations/NewConversationModal";
import { UserSearchModal } from "../components/conversations/UserSearchModal";
import { ContextRail } from "../components/conversations/ContextRail";

const CONVERSATION_STARTER_ROLES = ["owner", "admin", "manager"];

// Mobile-first conversation surface. Mobile: routed single pane — list and
// thread are separate routes (/conversations, /conversations/:conversationId).
// Desktop (>=769px): three panes side by side — list | thread | rail. The
// rail is a Phase C placeholder only; no rail logic lives here yet.
export function ConversationsPage({ user }) {
  const [orgCtx, setOrgCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    resolveActiveOrg(user.uid)
      .then(ctx => { if (!cancelled) setOrgCtx(ctx); })
      .catch(e => console.error("[conversations] resolveActiveOrg failed:", e.message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (!user) return <CenteredNote text="Sign in to view your conversations." />;
  if (loading) return <CenteredNote text="Loading conversations…" />;
  if (!orgCtx) return <CenteredNote text="You need to be an active member of an organization to use messaging." />;

  return (
    <Routes>
      <Route path="/" element={<ConversationsShell user={user} orgCtx={orgCtx} />} />
      <Route path=":conversationId" element={<ConversationsShellRouted user={user} orgCtx={orgCtx} />} />
    </Routes>
  );
}

function ConversationsShellRouted({ user, orgCtx }) {
  const { conversationId } = useParams();
  return <ConversationsShell user={user} orgCtx={orgCtx} conversationId={conversationId} />;
}

function ConversationsShell({ user, orgCtx, conversationId = null }) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showRailSheet, setShowRailSheet] = useState(false);
  const openConversation = (id) => navigate(`/conversations/${id}`);
  const backToList = () => navigate("/conversations");
  const canStartConversation = CONVERSATION_STARTER_ROLES.includes(orgCtx.membership?.role);

  const modal = (
    <>
      {showUserSearch && (
        <UserSearchModal
          user={user}
          onClose={() => setShowUserSearch(false)}
          onCreated={(id) => { setShowUserSearch(false); openConversation(id); }}
        />
      )}
      {showNewConversation && (
        <NewConversationModal
          user={user}
          orgCtx={orgCtx}
          onClose={() => setShowNewConversation(false)}
          onCreated={(id) => { setShowNewConversation(false); openConversation(id); }}
        />
      )}
    </>
  );

  if (!isDesktop) {
    return (
      <>
        {conversationId
          ? <MessageThread user={user} orgCtx={orgCtx} conversationId={conversationId} onBack={backToList} onOpenContext={() => setShowRailSheet(true)} />
          : <ConversationList user={user} orgCtx={orgCtx} onOpen={openConversation} onNewChat={() => setShowUserSearch(true)} canStartConversation={canStartConversation} onNewOrgConversation={() => setShowNewConversation(true)} />}
        {modal}
        {showRailSheet && conversationId && (
          <div style={{ position: "fixed", inset: 0, background: "#00000060", zIndex: 480, display: "flex", alignItems: "flex-end" }} onClick={() => setShowRailSheet(false)}>
            <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 15, color: "#080808" }}>Linked Context</div>
                <button onClick={() => setShowRailSheet(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888" }}>✕</button>
              </div>
              <ContextRail conversationId={conversationId} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="conv-desktop">
      <div className="conv-pane conv-pane-list">
        <ConversationList user={user} orgCtx={orgCtx} onOpen={openConversation} activeId={conversationId} onNewChat={() => setShowUserSearch(true)} canStartConversation={canStartConversation} onNewOrgConversation={() => setShowNewConversation(true)} />
      </div>
      <div className="conv-pane conv-pane-thread">
        {conversationId
          ? <MessageThread user={user} orgCtx={orgCtx} conversationId={conversationId} />
          : <CenteredNote text="Select a conversation to start reading." />}
      </div>
      <div className="conv-pane conv-pane-rail">
        {conversationId
          ? <ContextRail conversationId={conversationId} />
          : <CenteredNote text="Select a conversation to see linked context." />}
      </div>
      {modal}
    </div>
  );
}

function CenteredNote({ text }) {
  return (
    <div style={{ padding: 24, color: "#888", fontSize: 13, textAlign: "center" }}>{text}</div>
  );
}
