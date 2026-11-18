import { TRADES } from "../../data/jobsTaxonomy.js";

// Big, bilingual trade tiles (Hindi on top, English below) for skilled
// workers — phone-first, easy to tap. `value` is an array of TRADES keys.
export function TradeTiles({ value = [], onChange, single = false }) {
  const toggle = (k) => {
    if (single) return onChange(value.includes(k) ? [] : [k]);
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k]);
  };
  return (
    <div role="group" aria-label="Trades" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 8 }}>
      {TRADES.map(t => {
        const on = value.includes(t.key);
        return (
          <button type="button" key={t.key} onClick={() => toggle(t.key)} aria-pressed={on}
            style={{
              minHeight: 64, padding: "10px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              border: `2px solid ${on ? "var(--warn)" : "var(--b2)"}`, background: on ? "var(--s2)" : "var(--s1)",
            }}>
            <div lang="hi" style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", lineHeight: 1.2 }}>{on ? "✓ " : ""}{t.labelHi}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}
