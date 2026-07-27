import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/config";
import { sendMessage, sendAttachmentMessage } from "../../lib/conversations";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// A failed send (text or attachment) surfaces as a visible error, never a
// silent no-op.
export function MessageComposer({ conversationId, orgId, senderUid, senderOrgId }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const busy = sending || uploading;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
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

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Attachment too large (max 25MB).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // {orgId}/conversations/{conversationId}/{timestamp}_{filename}
      const path = `${orgId}/conversations/${conversationId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
      const url = await getDownloadURL(fileRef);
      const type = file.type.startsWith("image/") ? "image" : "file";
      await sendAttachmentMessage({
        conversationId, orgId, senderUid, senderOrgId, type,
        attachment: { url, name: file.name, size: file.size, mime: file.type },
      });
    } catch (e) {
      setError(e.message || "Failed to upload attachment.");
    }
    setUploading(false);
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
      {uploading && <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>Uploading attachment…</div>}
      <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button
          onClick={handleAttachClick}
          disabled={busy}
          title="Attach a file or image"
          style={{ padding: "8px 10px", borderRadius: 10, background: "#f5f5f5", border: "1px solid #e0e0e0", fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0 }}
        >
          📎
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          disabled={busy}
          style={{ flex: 1, resize: "none", padding: "8px 12px", borderRadius: 10, border: "1px solid #e0e0e0", fontSize: 13, fontFamily: "inherit", maxHeight: 100 }}
        />
        <button
          onClick={handleSend}
          disabled={busy || !text.trim()}
          style={{ padding: "8px 16px", borderRadius: 10, background: "#e85a2a", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.6 : 1 }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
