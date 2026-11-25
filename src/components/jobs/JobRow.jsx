import { Link } from "react-router-dom";
import { labelOf, URGENCY } from "../../data/jobsTaxonomy.js";
import { LaneMarker } from "./jobsUi";
import { LANE_COLOR, btnMuted, btnPrimary, card, chip, payLine } from "./jobsStyle";

// One job in a list: lane colour marker, title, business, location, chips,
// pay, and the apply state — same information order as the prototype's
// jobRow, in TIN's card style. `job` is a normalised job (+ job.raw).
export function JobRow({ job, isOwnListing, alreadyApplied, onApply, closed = false }) {
  const lane = job.isNeededNow ? "needed-now" : job.lane;
  const chips = [
    ...job.workTypeLabels,
    ...(job.legacyJobType ? [job.legacyJobType] : []),
    ...(job.tradeLabel ? [job.tradeLabel] : job.functionLabels.slice(0, 1)),
    ...(!job.tradeLabel && !job.functionLabels.length && job.legacyCategory ? [job.legacyCategory] : []),
    ...(job.headcount > 1 ? [`${job.headcount} people`] : []),
  ];
  const sa = job.shortAssignment;
  const urgent = sa?.urgency === "today_tomorrow";
  const pay = payLine(job);

  return (
    <div className="tj-row" style={{ ...card, padding: 14, display: "flex", gap: 12, borderLeft: `3px solid ${LANE_COLOR[lane]}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
          <Link to={`/jobs/${job.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)", textDecoration: "none" }}>{job.title}</Link>
          {job.postedByType === "verified_business" && (
            <span className="badge bv">✓ Verified</span>
          )}
          {urgent && <span className="badge bc">Urgent</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>
          {job.businessName || job.postedByName || "Individual poster"}
          {job.city ? ` · 📍 ${job.city}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: pay || sa ? 8 : 0 }}>
          {chips.map((c, i) => <span key={i} style={chip}>{c}</span>)}
          {sa?.duration && <span style={chip}>⏱ {sa.duration}</span>}
          {sa?.startDate && <span style={chip}>Starts {sa.startDate}</span>}
          {sa?.urgency && !urgent && <span style={chip}>{labelOf(URGENCY, sa.urgency)}</span>}
        </div>
        {pay && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{pay}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
        <LaneMarker lane={lane} />
        {closed ? (
          <button disabled style={btnMuted}>Closed</button>
        ) : isOwnListing ? (
          <button disabled style={btnMuted}>Your listing</button>
        ) : alreadyApplied ? (
          <button disabled style={btnMuted}>{alreadyApplied === "shortlisted" ? "✓ Shortlisted" : alreadyApplied === "declined" ? "Not interested" : "✓ Applied"}</button>
        ) : (
          <button onClick={() => onApply(job.raw)} style={btnPrimary}>Apply</button>
        )}
      </div>
    </div>
  );
}
