// Switches on message.type. Unknown/future types render a safe fallback
// instead of crashing — never assume a type not in this switch.
export function MessageItem({ message, isOwn }) {
  switch (message.type) {
    case "text":
      return <Bubble isOwn={isOwn}>{message.text}</Bubble>;
    case "image":
      return <ImageBubble message={message} isOwn={isOwn} />;
    case "file":
      return <FileBubble message={message} isOwn={isOwn} />;
    case "reference":
      return <ReferenceBubble message={message} isOwn={isOwn} />;
    default:
      return (
        <Bubble isOwn={isOwn} unsupported>
          Unsupported message
        </Bubble>
      );
  }
}

function Bubble({ isOwn, unsupported = false, children }) {
  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "72%",
          padding: "8px 12px",
          borderRadius: 14,
          fontSize: 13,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: unsupported ? "#f5f5f5" : isOwn ? "#e85a2a" : "#fff",
          color: unsupported ? "#888" : isOwn ? "#fff" : "#080808",
          border: unsupported ? "1px dashed #ccc" : isOwn ? "none" : "1px solid #e0e0e0",
          fontStyle: unsupported ? "italic" : "normal",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ImageBubble({ message, isOwn }) {
  const { attachment } = message;
  if (!attachment?.url) return <Bubble isOwn={isOwn} unsupported>Unsupported message</Bubble>;
  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{ maxWidth: "72%" }}>
        <a href={attachment.url} target="_blank" rel="noreferrer">
          <img src={attachment.url} alt={attachment.name || "Image"} style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 12, display: "block", border: "1px solid #e0e0e0" }} />
        </a>
        {message.text && (
          <div style={{ fontSize: 12, color: "#080808", marginTop: 4, padding: "0 2px" }}>{message.text}</div>
        )}
      </div>
    </div>
  );
}

function FileBubble({ message, isOwn }) {
  const { attachment } = message;
  if (!attachment?.url) return <Bubble isOwn={isOwn} unsupported>Unsupported message</Bubble>;
  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "72%", padding: "8px 12px", borderRadius: 14, background: "#fff", border: "1px solid #e0e0e0", textDecoration: "none", color: "#080808" }}
      >
        <span style={{ fontSize: 18 }}>📄</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{attachment.name || "File"}</div>
          {attachment.size != null && <div style={{ fontSize: 10, color: "#888" }}>{formatBytes(attachment.size)}</div>}
        </div>
      </a>
    </div>
  );
}

function ReferenceBubble({ message, isOwn }) {
  const { attachment } = message;
  return (
    <div style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <a
        href={attachment?.url || "#"}
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "72%", padding: "8px 12px", borderRadius: 14, background: "#fff8f5", border: "1px solid #fde0d0", textDecoration: "none", color: "#080808" }}
      >
        <span style={{ fontSize: 18 }}>🔗</span>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{attachment?.name || "Shared reference"}</div>
      </a>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
