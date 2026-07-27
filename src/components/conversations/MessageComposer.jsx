import { useState } from "react";
import { sendMessage } from "../../lib/conversations";

// Text send only — attachment upload (image/file) lands in commit 6.
// A failed send surfaces as a visible error, never a silent no-op.
export function MessageComposer({ conversationId, orgId, senderUid, senderOrgId }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ conversationId, orgId, senderUid, senderOrgId, text: trimmed });
      setText("");
    } catch (e) {
      setError(e.message || "Failed to send message.");
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ borderTop: "1px solid #e0e0e0", background: "#fff", padding: 10, flexShrink: 0 }}>
      {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          disabled={sending}
          style={{ flex: 1, resize: "none", padding: "8px 12px", borderRadius: 10, border: "1px solid #e0e0e0", fontSize: 13, fontFamily: "inherit", maxHeight: 100 }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          style={{ padding: "8px 16px", borderRadius: 10, background: "#e85a2a", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: sending || !text.trim() ? "default" : "pointer", opacity: sending || !text.trim() ? 0.6 : 1 }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
