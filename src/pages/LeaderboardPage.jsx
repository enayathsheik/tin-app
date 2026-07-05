import { getLevel } from "../utils/helpers";

export function LeaderboardPage({ contributors }) {
  const sorted = [...contributors].sort((a, b) => b.points - a.points);
  const total = contributors.reduce((s, c) => s + c.storesAdded, 0);
  const avColors = ["#f59e0b","#9ca3af","#cd7f32","#6366f1","#22c55e","#ec4899"];

  return (
    <div className="lb-pg">
      <div className="lb-wrap">
        <div className="lb-hd">
          <div className="lb-title">Leaderboard</div>
          <div className="lb-sub">Top Market Champions building India's trade intelligence</div>
        </div>
        <div className="lb-stats">
          <div className="lb-stat"><div className="lb-sv">{contributors.length}</div><div className="lb-sl">Contributors</div></div>
          <div className="lb-stat"><div className="lb-sv">{total}</div><div className="lb-sl">Stores Added</div></div>
          <div className="lb-stat"><div className="lb-sv">{contributors.length > 0 ? Math.max(...contributors.map(c => c.citiesCovered || 0)) : 0}+</div><div className="lb-sl">Cities</div></div>
          <div className="lb-stat"><div className="lb-sv">{total.toLocaleString()}</div><div className="lb-sl">Total Records</div></div>
        </div>
        {sorted.map((c, i) => {
          const lv = getLevel(c.points);
          return (
            <div key={c.id} className="lb-row" style={i < 3 ? { background: "#1a1a26", borderColor: "#ffffff14" } : {}}>
              <div className={`lb-rank`} style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "var(--t3)" }}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
              </div>
              <div className="lb-av" style={{ background: `linear-gradient(135deg, ${avColors[i % avColors.length]}, ${avColors[(i + 2) % avColors.length]})` }}>
                {c.name.charAt(0)}
              </div>
              <div className="lb-info">
                <div className="lb-name" style={{color:i<3?"#e85a2a":"#080808"}}>{c.name}</div>
                <div className="lb-meta" style={{color:i<3?"#e85a2a":"#555555"}}>{c.storesAdded} stores · {c.citiesCovered} cities · {c.city}</div>
              </div>
              <div className="lb-pts">
                <div className="lb-pv">{c.points.toLocaleString()}</div>
                <div className="lb-lv" style={{ color: lv.color }}>{lv.name}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
