import { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { resolveActiveOrg } from "../lib/tenancy";
import { useIsDesktop } from "../hooks/useIsDesktop";

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
  const openConversation = (id) => navigate(`/conversations/${id}`);
  const backToList = () => navigate("/conversations");

  if (!isDesktop) {
    return conversationId
      ? <ThreadPane user={user} orgCtx={orgCtx} conversationId={conversationId} onBack={backToList} />
      : <ListPane user={user} orgCtx={orgCtx} onOpen={openConversation} />;
  }

  return (
    <div className="conv-desktop">
      <div className="conv-pane conv-pane-list">
        <ListPane user={user} orgCtx={orgCtx} onOpen={openConversation} activeId={conversationId} />
      </div>
      <div className="conv-pane conv-pane-thread">
        {conversationId
          ? <ThreadPane user={user} orgCtx={orgCtx} conversationId={conversationId} />
          : <CenteredNote text="Select a conversation to start reading." />}
      </div>
      <div className="conv-pane conv-pane-rail">
        {/* Phase C: context rail (linked entities, AI suggestion chip) lands here. */}
      </div>
    </div>
  );
}

// Placeholders — replaced by ConversationList (commit 3) and MessageThread (commit 4).
function ListPane() {
  return <CenteredNote text="Conversation list coming up next." />;
}
function ThreadPane() {
  return <CenteredNote text="Message thread coming up next." />;
}

function CenteredNote({ text }) {
  return (
    <div style={{ padding: 24, color: "#888", fontSize: 13, textAlign: "center" }}>{text}</div>
  );
}
