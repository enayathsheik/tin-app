export function Toast({ msg, type, show }) {
  return <div className={`toast ${type} ${show ? "show" : ""}`}>{type === "ok" ? "✓ " : "✗ "}{msg}</div>;
}
