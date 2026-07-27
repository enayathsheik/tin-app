// Switches on message.type. Unknown/future types render a safe fallback
// instead of crashing — never assume a type not in this switch.
export function MessageItem({ message, isOwn }) {
  switch (message.type) {
    case "text":
      return <Bubble isOwn={isOwn}>{message.text}</Bubble>;
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
