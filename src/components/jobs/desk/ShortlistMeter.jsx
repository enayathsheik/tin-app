// L10: "Shortlisted 7 of 10" per job, and at the limit the owner's message
// with a Post a Job button (free during launch; price from Pricing later).
import { useNavigate } from "react-router-dom";
import { SHORTLIST_FULL_MESSAGE, shortlistCountOf } from "../../../utils/shortlist.js";

export function ShortlistMeter({ job, limit, compact = false }) {
  const navigate = useNavigate();
  const used = Math.min(shortlistCountOf(job), limit);
  const full = used >= limit;
  if (compact) {
    return <span style={{ fontSize: 12, fontWeight: 700, color: full ? "#b45309" : "var(--t3)" }}>Shortlisted {used} of {limit}</span>;
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
        <span>Shortlisted {used} of {limit}</span>
        <div aria-hidden="true" style={{ flex: 1, maxWidth: 180, height: 6, borderRadius: 3, background: "var(--s2)", overflow: "hidden" }}>
          <div style={{ width: `${(used / limit) * 100}%`, height: "100%", background: full ? "#d97706" : "#16a34a" }} />
        </div>
      </div>
      {full && (
        <div role="status" style={{ marginTop: 8, fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
          {SHORTLIST_FULL_MESSAGE(limit)}
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => navigate("/jobs/post")}
              style={{ minHeight: 40, padding: "0 14px", borderRadius: 8, border: "none", background: "#e85a2a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + Post a Job
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
