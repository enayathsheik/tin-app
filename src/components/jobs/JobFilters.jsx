import { CITIES } from "../../data/constants";
import { FUNCS, INDUSTRIES, TRADES, TYPES } from "../../data/jobsTaxonomy.js";
import { EXPERIENCE_BANDS, PAY_BANDS } from "../../utils/jobFilters.js";
import { btnPrimary, card, fieldLabel } from "./jobsStyle";

// Filter panel for a lane page. Values are taxonomy keys / band ids; ""
// means "Any". `lane` decides function (professional) vs trade (skilled);
// Needed Now shows both. Pay bands are limited to the periods that make
// sense for the lane (monthly for professional, daily + monthly otherwise).
// Filters apply as soon as they change (desktop sidebar is live). On the
// phone the panel also gets a "Show N results" button (L5) that closes it
// and jumps to the list — `resultCount` null while loading.
export function JobFilters({ lane, f, onChange, onClear, open, resultCount = null, onShowResults }) {
  const showFn = lane !== "skilled";
  const showTrade = lane !== "professional";
  const payBands = lane === "professional" ? PAY_BANDS.filter(b => b.period === "month") : PAY_BANDS;
  const set = (k) => (e) => onChange(k, e.target.value);
  const active = Object.values(f).some(Boolean);

  return (
    <aside className={`tj-side${open ? " open" : ""}`} style={{ ...card, padding: 14, flexDirection: "column", gap: 10 }}>
      <label>
        <div style={fieldLabel}>Search</div>
        <input className="fi" placeholder={lane === "skilled" ? "Trade, area" : "Role, company, skill"} value={f.q || ""} onChange={set("q")} />
      </label>
      {showFn && (
        <label>
          <div style={fieldLabel}>Function</div>
          <select className="fi" value={f.fn || ""} onChange={set("fn")}>
            <option value="">All functions</option>
            {FUNCS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      )}
      {showTrade && (
        <label>
          <div style={fieldLabel}>Trade</div>
          <select className="fi" value={f.trade || ""} onChange={set("trade")}>
            <option value="">All trades</option>
            {TRADES.map(o => <option key={o.key} value={o.key}>{o.label} · {o.labelHi}</option>)}
          </select>
        </label>
      )}
      <label>
        <div style={fieldLabel}>Industry</div>
        <select className="fi" value={f.ind || ""} onChange={set("ind")}>
          <option value="">All industries</option>
          {INDUSTRIES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <label>
        <div style={fieldLabel}>Work type</div>
        <select className="fi" value={f.type || ""} onChange={set("type")}>
          <option value="">Any work type</option>
          {TYPES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <label>
        <div style={fieldLabel}>City</div>
        <input className="fi" list="tj-cities" placeholder="Any city" value={f.city || ""} onChange={set("city")} />
        <datalist id="tj-cities">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
      </label>
      <label>
        <div style={fieldLabel}>Experience</div>
        <select className="fi" value={f.exp || ""} onChange={set("exp")}>
          <option value="">Any experience</option>
          {EXPERIENCE_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      <label>
        <div style={fieldLabel}>Pay</div>
        <select className="fi" value={f.pay || ""} onChange={set("pay")}>
          <option value="">Any pay</option>
          {payBands.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.4 }}>
        Jobs with negotiable, hidden or unclear pay or experience, and older jobs with no industry, show only under "Any" / "All".
      </div>
      {active && (
        <button onClick={onClear} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--acc)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          Clear filters
        </button>
      )}
      {onShowResults && (
        <button type="button" className="tj-show-results" onClick={onShowResults}
          style={{ ...btnPrimary, width: "100%", minHeight: 48, fontSize: 15, justifyContent: "center", alignItems: "center", marginTop: 4 }}>
          {resultCount == null ? "Show results" : resultCount === 0 ? "No matching jobs — close" : `Show ${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        </button>
      )}
    </aside>
  );
}
