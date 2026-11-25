// Employer Desk (C): how many people are shortlisted, contacted, at interview,
// offered and hired — for one job or all of them. Tap a number for the list.
import { PEOPLE_BUCKETS } from "../../../utils/employerDesk.js";
import { card, heading } from "../jobsStyle";

export function PeopleCounts({ counts, loading = false, selected = "", onPick }) {
  return (
    <>
      <div role="group" aria-label="People" className="desk-people">
        {PEOPLE_BUCKETS.map(b => {
          const n = counts[b.key];
          const on = selected === b.key;
          return (
            <button key={b.key} type="button" aria-pressed={on} disabled={loading} onClick={() => onPick(on ? "" : b.key)}
              style={{ ...card, padding: "10px 8px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderColor: on ? "var(--acc)" : "var(--b2)", background: on ? "#e85a2a14" : "var(--s1)", minWidth: 0 }}>
              <div style={{ ...heading, fontSize: 24, lineHeight: 1, color: n && !loading ? "var(--acc)" : "var(--t1)" }}>{loading ? "…" : n}</div>
              <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>{b.label}</div>
            </button>
          );
        })}
      </div>
      <style>{".desk-people{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px}@media(max-width:560px){.desk-people{grid-template-columns:repeat(3,minmax(0,1fr))}}"}</style>
    </>
  );
}
