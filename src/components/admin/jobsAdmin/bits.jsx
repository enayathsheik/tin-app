// Small shared pieces for Admin → TIN Jobs Admin.
import { useState } from "react";
import { resumeUrl } from "../../../lib/jobsAdmin";

const nowrap = { whiteSpace: "nowrap" };

export const Phone = ({ value }) => (value ? <a href={`tel:${value.replace(/[^\d+]/g, "")}`} style={{ color: "inherit", ...nowrap }}>{value}</a> : "—");
export const Email = ({ value }) => (value ? <a href={`mailto:${value}`} style={{ color: "inherit" }}>{value}</a> : "—");

const STATE_STYLE = {
  open: ["#15803d", "#f0fdf4"], paused: ["#b45309", "#fffbeb"], pending: ["#b45309", "#fffbeb"],
  filled: ["#1d4ed8", "#eff6ff"], closed: ["#6b7280", "#f3f4f6"], rejected: ["#b91c1c", "#fef2f2"],
  Verified: ["#15803d", "#f0fdf4"], "Store verified": ["#15803d", "#f0fdf4"], "Not verified": ["#6b7280", "#f3f4f6"],
  approved: ["#15803d", "#f0fdf4"], none: ["#6b7280", "#f3f4f6"],
  Complete: ["#15803d", "#f0fdf4"], Incomplete: ["#b45309", "#fffbeb"], "No profile": ["#6b7280", "#f3f4f6"],
  "Sign-up": ["#1d4ed8", "#eff6ff"], "Job post": ["#c2410c", "#fff3ef"], Application: ["#15803d", "#f0fdf4"], "Search shortlist": ["#7c3aed", "#f5f3ff"],
};
export function Pill({ kind, children }) {
  const [color, background] = STATE_STYLE[kind] || STATE_STYLE.closed;
  return <span style={{ color, background, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 8px", ...nowrap }}>{children}</span>;
}

// Opens the resume's Firebase Storage download URL (asked for on click).
export function ResumeButton({ resume, label = "View / Download" }) {
  const [state, setState] = useState("");
  if (!resume) return <span style={{ color: "var(--t3)" }}>No resume</span>;
  const open = async () => {
    const win = window.open("", "_blank"); // opened on the click so pop-up blockers allow it
    if (win) win.opener = null;
    setState("busy");
    try {
      const url = await resumeUrl(resume);
      if (win) win.location.href = url; else window.open(url, "_blank", "noopener");
      setState("");
    } catch (e) {
      console.error("[jobs-admin] resume open failed:", e);
      win?.close();
      setState(e?.code === "storage/object-not-found" ? "File not found" : "Couldn't open");
    }
  };
  return (
    <span style={nowrap}>
      <button type="button" className="btn-sm btn-out" style={{ padding: "4px 10px" }} disabled={state === "busy"} onClick={open} title={resume.fileName}>
        📄 {state === "busy" ? "Opening…" : label}
      </button>
      {state && state !== "busy" && <span role="alert" style={{ color: "#b91c1c", fontSize: 11, marginLeft: 6 }}>{state}</span>}
    </span>
  );
}

const field = { width: "auto", minWidth: 0, padding: "8px 10px", fontSize: 13 };

// Search box + city / role / status / date range, with Export on the right.
export function FilterBar({ f, set, cities, roles, roleLabel, lanes, statuses, statusLabel = "All statuses", searchHint, count, total, onExport, dateLabel }) {
  const [exp, setExp] = useState({ busy: false, error: "" });
  const up = (k) => (e) => set({ ...f, [k]: e.target.value });
  const active = Object.values(f).some(Boolean);
  const run = async () => {
    setExp({ busy: true, error: "" });
    try { await onExport(); setExp({ busy: false, error: "" }); } catch (e) {
      console.error("[jobs-admin] export failed:", e);
      setExp({ busy: false, error: "Export failed: " + (e.message || e) });
    }
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input className="fi" type="search" aria-label="Search" placeholder={searchHint} value={f.q} onChange={up("q")} style={{ ...field, flex: "1 1 220px", maxWidth: 360 }} />
        <select className="fi" aria-label="City" value={f.city} onChange={up("city")} style={field}>
          <option value="">All cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="fi" aria-label={roleLabel} value={f.role} onChange={up("role")} style={{ ...field, maxWidth: 220 }}>
          <option value="">{roleLabel}</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {lanes && (
          <select className="fi" aria-label="Lane" value={f.lane} onChange={up("lane")} style={field}>
            <option value="">All lanes</option>
            {lanes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {statuses && (
          <select className="fi" aria-label="Status" value={f.status} onChange={up("status")} style={field}>
            <option value="">{statusLabel}</option>
            {statuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        <label style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4 }}>
          {dateLabel} from <input className="fi" type="date" value={f.from} max={f.to || undefined} onChange={up("from")} style={field} />
        </label>
        <label style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4 }}>
          to <input className="fi" type="date" value={f.to} min={f.from || undefined} onChange={up("to")} style={field} />
        </label>
        {active && <button type="button" className="btn-sm btn-out" onClick={() => set(Object.fromEntries(Object.keys(f).map(k => [k, ""])))}>Clear</button>}
        <button type="button" className="btn-sm btn-out" style={{ marginLeft: "auto" }} disabled={exp.busy || !count} onClick={run}>
          {exp.busy ? "Preparing…" : `📥 Download Excel (${count})`}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>{count === total ? `${total} in total` : `Showing ${count} of ${total}`}</div>
      {exp.error && <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>⚠ {exp.error}</div>}
    </div>
  );
}

const PAGE = 100;

// columns: [header, (row) => cell][]. Shows 100 rows at a time.
export function DataTable({ columns, rows, rowKey, empty, minWidth = 900 }) {
  const [shown, setShown] = useState(PAGE);
  if (!rows.length) return <div style={{ padding: 24, color: "var(--t3)", fontSize: 14 }}>{empty}</div>;
  return (
    <>
      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth }}>
          <thead><tr>{columns.map(([h]) => <th key={h} style={nowrap}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.slice(0, shown).map(r => (
              <tr key={rowKey(r)}>{columns.map(([h, cell]) => <td key={h} style={{ verticalAlign: "top" }}>{cell(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button type="button" className="btn-sm btn-out" style={{ marginTop: 10 }} onClick={() => setShown(n => n + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more ({rows.length - shown} left)
        </button>
      )}
    </>
  );
}

export function Facts({ rows }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 170px) 1fr", gap: "6px 12px", margin: 0, fontSize: 13 }}>
      {rows.filter(([, v]) => v !== "" && v != null).map(([k, v]) => [
        <dt key={k + "t"} style={{ color: "var(--t3)" }}>{k}</dt>,
        <dd key={k + "d"} style={{ margin: 0, color: "var(--t1)", overflowWrap: "anywhere" }}>{v}</dd>,
      ])}
    </dl>
  );
}
