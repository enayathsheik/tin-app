// Small form building blocks for the Post-a-job wizard, in TIN's existing
// form style (fi / fta inputs, the uppercase 10px labels PostJobModal used).
import { fieldLabel } from "./jobsStyle";

export function Field({ label, required, optional, hint, error, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={fieldLabel}>
        {label}{required && <span style={{ color: "#e85a2a" }}> *</span>}
        {optional && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}> (optional)</span>}
      </div>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{hint}</div>}
      {error && <div role="alert" style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠ {error}</div>}
    </label>
  );
}

// Toggle chips. multiple=true → value is an array of keys; else a single key.
export function Pick({ options, value, onChange, multiple = false, accent = "var(--acc)", label }) {
  const isOn = (k) => (multiple ? (value || []).includes(k) : value === k);
  const toggle = (k) => {
    if (!multiple) return onChange(k);
    const cur = value || [];
    onChange(cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);
  };
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = isOn(o.key);
        return (
          <button type="button" key={o.key} onClick={() => toggle(o.key)} aria-pressed={on}
            style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${on ? accent : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)",
              color: on ? "var(--t1)" : "var(--t2)", boxShadow: on ? `inset 0 0 0 1px ${accent}` : "none",
            }}>
            {on ? "✓ " : ""}{o.label}{o.labelHi ? <span lang="hi" style={{ color: "var(--t3)", fontWeight: 400 }}> · {o.labelHi}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// Big two-way choice cards (lane, "tick a list" vs "write it yourself").
export function Choice({ options, value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, gap: 8, marginBottom: 14 }}>
      {options.map(o => {
        const on = value === o.key;
        return (
          <button type="button" key={o.key} onClick={() => onChange(o.key)} aria-pressed={on}
            style={{
              textAlign: "left", padding: 12, borderRadius: "var(--r)", cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${on ? (o.color || "var(--acc)") : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)",
              borderTop: `3px solid ${o.color || (on ? "var(--acc)" : "var(--b2)")}`,
            }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{on ? "✓ " : ""}{o.label}</div>
            {o.desc && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{o.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}
