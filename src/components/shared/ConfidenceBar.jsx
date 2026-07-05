export function ConfidenceBar({ value, size = "sm" }) {
  const color = value >= 80 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  if (size === "sm") return (
    <div className="conf-bar"><div className="conf-fill" style={{ width: `${value}%`, background: color }} /></div>
  );
  return (
    <div className="conf-bar2"><div className="conf-fill2" style={{ width: `${value}%`, background: color }} /></div>
  );
}
