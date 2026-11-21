// Small shared components for the Jobs pages. Layout rules that need media
// queries live in <JobsStyles/> under a tj- prefix so they can't collide.
// Style constants and helpers are in jobsStyle.js.
import { LANE_COLOR } from "./jobsStyle";

export function LaneMarker({ lane, size = 8 }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: LANE_COLOR[lane] || "var(--b3)", flexShrink: 0 }} />;
}

export function JobsStyles() {
  return (
    <style>{`
      .tj-scroll{height:100%;width:100%;overflow-y:auto}
      .tj-wrap{max-width:1100px;margin:0 auto;padding:16px 16px 100px;position:relative;min-height:60vh}
      .tj-lay{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
      .tj-side{display:none}
      .tj-side.open{display:flex}
      .tj-filters-btn{display:inline-flex}
      .tj-show-results{display:flex}
      .tj-rows{display:flex;flex-direction:column;gap:10px}
      .tj-lanes{display:grid;grid-template-columns:1fr;gap:12px}
      .tj-strip{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}
      .tj-strip > *{scroll-snap-align:start;flex:0 0 240px}
      .tj-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
      .tj-trades{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}
      .tj-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .tj-tile{text-align:left;cursor:pointer;font-family:inherit}
      .tj-tile:hover{border-color:var(--b3)}
      .tj-row:hover{border-color:var(--b3)}
      @media (min-width:760px){
        .tj-lay{grid-template-columns:240px 1fr}
        .tj-side,.tj-side.open{display:flex;position:sticky;top:12px}
        .tj-filters-btn{display:none}
        .tj-show-results{display:none}
        .tj-lanes{grid-template-columns:1fr 1fr}
        .tj-facts{grid-template-columns:repeat(3,1fr)}
      }
    `}</style>
  );
}
