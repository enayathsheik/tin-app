import { MOCK_CONTRACTORS, MOCK_ARCHITECTS, MOCK_LEADS, CASH_REWARDS, BULK_REWARDS } from "../data/constants";

export function RewardsPage({ user, onMessageAdmin }) {
  const points = user.points || 0;
  const city = user.city || "Mumbai";
  const isLegend = points >= 10000;
  const fullAccess = points >= 10000;

  // How many profiles unlocked
  const contractorsUnlocked = Math.floor(points / 30);
  const architectsUnlocked = Math.floor(points / 60);

  // Filter by city
  const cityContractors = MOCK_CONTRACTORS.filter(c => c.city === city);
  const cityArchitects = MOCK_ARCHITECTS.filter(a => a.city === city);

  // Which ones are revealed
  const revealedContractors = MOCK_CONTRACTORS.slice(0, Math.min(contractorsUnlocked, MOCK_CONTRACTORS.length));
  const revealedArchitects = MOCK_ARCHITECTS.slice(0, Math.min(architectsUnlocked, MOCK_ARCHITECTS.length));

  const nextCashReward = CASH_REWARDS.find(r => r.points > points);
  const ptsToNext = nextCashReward ? nextCashReward.points - points : 0;
  const refCode = user.referralCode || `TIN${(user.name||"USER").toUpperCase().replace(/\s/g,"").substring(0,5)}${String(user.uid||"").slice(-3).toUpperCase() || "001"}`;

  const avColors = ["#e85a2a","#3b82f6","#22c55e","#f59e0b","#8b5cf6","#ec4899"];

  return (
    <div className="rewards-pg">
      <div className="rewards-wrap">
        <div className="rewards-hd">
          <div className="rewards-title">My Rewards</div>
          <div className="rewards-sub">Points, perks and cash rewards for your contributions</div>
        </div>

        {/* HERO POINTS */}
        <div className="reward-hero">
          <div className="reward-pts-big">{points.toLocaleString()}</div>
          <div className="reward-pts-label">Total Points Earned</div>
          {nextCashReward && (
            <div style={{fontSize:13,color:"var(--acc)",fontWeight:700,marginTop:8}}>
              {ptsToNext} more points to unlock {nextCashReward.label}
            </div>
          )}
          <div className="reward-progress-row">
            {CASH_REWARDS.map(r => {
              const unlocked = points >= r.points;
              const isNext = !unlocked && (!CASH_REWARDS.find(x => x.points > points && x.points < r.points));
              const pct = Math.min((points / r.points) * 100, 100);
              return (
                <div key={r.points} className={`reward-milestone ${unlocked?"unlocked":isNext?"next":""}`}>
                  <div className="rm-pts" style={{color:unlocked?"var(--ok)":isNext?"var(--acc)":"var(--t3)"}}>{r.points.toLocaleString()}</div>
                  <div className="rm-reward" style={{color:unlocked?"var(--ok)":isNext?"var(--acc)":"var(--t2)"}}>{r.label}</div>
                  <div style={{height:4,background:"var(--b2)",borderRadius:2,margin:"8px 0 4px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:unlocked?"var(--ok)":"var(--acc)",borderRadius:2,transition:"width .8s ease"}}/>
                  </div>
                  <div className="rm-status" style={{color:unlocked?"var(--ok)":isNext?"var(--acc)":"var(--t3)"}}>
                    {unlocked?"✓ Unlocked":isNext?`${(r.points-points).toLocaleString()} pts to go`:"Locked"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTRACTOR VISIBILITY */}
        <div className="section-card">
          <div className="sc-title">🔧 Contractor Profiles <span className="badge bp">{Math.min(contractorsUnlocked, MOCK_CONTRACTORS.length)} unlocked</span></div>
          <div className="sc-sub">Every 30 points unlocks 1 contractor profile from your city · Full profile at 10,000 points</div>
          <div className="unlock-counter">
            <div className="unlock-num">{contractorsUnlocked}</div>
            <div><div className="unlock-label">Contractor profiles unlocked</div><div style={{fontSize:11,color:"#080808"}}>Next unlock in {30 - (points % 30)} points</div></div>
          </div>
          {MOCK_CONTRACTORS.map((c, i) => {
            const revealed = i < contractorsUnlocked;
            return revealed ? (
              <div key={c.id} className="profile-reveal">
                <div className="pr-av" style={{background:`linear-gradient(135deg,${avColors[i%avColors.length]},${avColors[(i+2)%avColors.length]})`}}>{c.name.charAt(0)}</div>
                <div className="pr-info">
                  <div className="pr-name">{c.name}</div>
                  <div className="pr-meta">{c.category} · {c.city} · {c.experience}</div>
                  {fullAccess && <div style={{fontSize:11,color:"#080808",marginTop:2}}>{c.specialization} · {c.email||"—"}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="pr-phone">{c.phone}</div>
                  {fullAccess && c.linkedin && <div style={{fontSize:11,color:"var(--info)",marginTop:3}}>LinkedIn ↗</div>}
                </div>
              </div>
            ) : (
              <div key={c.id} className="locked-overlay">
                🔒 <span>Locked — earn {(i+1)*30 - points} more points to unlock</span>
              </div>
            );
          })}
        </div>

        {/* ARCHITECT VISIBILITY */}
        <div className="section-card">
          <div className="sc-title">📐 Architect & Designer Profiles <span className="badge bp">{Math.min(architectsUnlocked, MOCK_ARCHITECTS.length)} unlocked</span></div>
          <div className="sc-sub">Every 60 points unlocks 1 architect/designer profile · Full profile at 10,000 points</div>
          <div className="unlock-counter">
            <div className="unlock-num">{architectsUnlocked}</div>
            <div><div className="unlock-label">Architect profiles unlocked</div><div style={{fontSize:11,color:"#080808"}}>Next unlock in {60 - (points % 60)} points</div></div>
          </div>
          {MOCK_ARCHITECTS.map((a, i) => {
            const revealed = i < architectsUnlocked;
            return revealed ? (
              <div key={a.id} className="profile-reveal">
                <div className="pr-av" style={{background:`linear-gradient(135deg,${avColors[(i+1)%avColors.length]},${avColors[(i+3)%avColors.length]})`}}>{a.name.charAt(0)}</div>
                <div className="pr-info">
                  <div className="pr-name">{a.name}</div>
                  <div className="pr-meta">{a.category} · {a.city} · {a.experience}</div>
                  {fullAccess && <div style={{fontSize:11,color:"#080808",marginTop:2}}>{a.specialization} · {a.email||"—"}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="pr-phone">{a.phone}</div>
                  {fullAccess && a.linkedin && <div style={{fontSize:11,color:"var(--info)",marginTop:3}}>LinkedIn ↗</div>}
                </div>
              </div>
            ) : (
              <div key={a.id} className="locked-overlay">
                🔒 <span>Locked — earn {(i+1)*60 - points} more points to unlock</span>
              </div>
            );
          })}
        </div>

        {/* LEGEND — LEADS ACCESS */}
        {isLegend ? (
          <div className="section-card">
            <div className="sc-title">⭐ Client & Market Leads <span className="badge bv">Legend Access</span></div>
            <div className="sc-sub">Exclusive project and market leads — available only to Legend contributors</div>
            {MOCK_LEADS.map(l => (
              <div key={l.id} className="leads-card">
                <div className="lc-type">{l.type}</div>
                <div className="lc-title">{l.title}</div>
                <div className="lc-meta">
                  <span>📍 {l.city}</span>
                  <span>💰 {l.budget}</span>
                  <span>📦 {l.category}</span>
                  <span>📅 {l.date}</span>
                </div>
                <div style={{marginTop:10}}><button className="btn-sm btn-acc">View Contact →</button></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="section-card" style={{opacity:.7}}>
            <div className="sc-title">⭐ Client & Market Leads <span className="badge bc">Legend Only</span></div>
            <div className="sc-sub">Unlock at 10,000 points — get exclusive project leads and market intelligence</div>
            <div style={{textAlign:"center",padding:"20px 0",color:"#080808"}}>
              <div style={{fontSize:32,marginBottom:8}}>🔒</div>
              <div style={{fontSize:13}}>Earn {(10000-points).toLocaleString()} more points to unlock Legend access</div>
            </div>
          </div>
        )}

        {/* BULK DATA REWARDS */}
        <div className="section-card">
          <div className="sc-title">📤 Bulk Data Rewards</div>
          <div className="sc-sub">Upload verified bulk data and earn cash rewards. Contact admin to submit.</div>
          {BULK_REWARDS.map(r => (
            <div key={r.type} className="bulk-reward-card">
              <div className="brc-info">
                <div className="brc-title">{r.type}</div>
                <div className="brc-detail">Minimum {r.count} verified records · One-time reward · Fake data excluded</div>
              </div>
              <div className="brc-reward">
                <div className="brc-amount">₹{r.amount.toLocaleString()}</div>
                <div className="brc-pts">+{r.points} pts</div>
              </div>
            </div>
          ))}
          <button className="msg-btn" onClick={onMessageAdmin}>
            💬 Message Admin to Upload Bulk Data
          </button>
        </div>

        {/* REFERRAL */}
        <div className="section-card">
          <div className="sc-title">🤝 Refer a Contributor</div>
          <div className="sc-sub">Earn +50 points for every new Market Champion who joins using your referral code and gets validated.</div>
          <div className="referral-card">
            <div style={{fontSize:12,color:"#080808"}}>Your referral code</div>
            <div className="ref-code">{refCode}</div>
            <div style={{fontSize:12,color:"#080808"}}>Share this code with colleagues in building materials industry. You earn 50 points once they are validated.</div>
            <button className="btn-sm btn-acc" style={{marginTop:10}} onClick={()=>{navigator.clipboard?.writeText(refCode);alert("Code copied!")}}>Copy Code</button>
          </div>
        </div>

        {/* BONUS POINTS INFO */}
        <div className="section-card">
          <div className="sc-title">⚡ Bonus Points Scheme</div>
          <div className="sc-sub">Ways to earn extra points beyond regular contributions</div>
          {[
            {icon:"🏷",label:"Business Owner Claims Your Store",pts:"+10 bonus pts",desc:"When a store you added gets claimed by the owner"},
            {icon:"👥",label:"Referral — New Contributor Joins",pts:"+50 pts",desc:"Per validated contributor who joins using your code"},
            {icon:"📤",label:"Bulk Data Upload (verified)",pts:"+1 pt/record",desc:"After admin verification — fake data not counted"},
            {icon:"⭐",label:"Legend Status",pts:"10,000 pts",desc:"Full profile access + Client & Market Leads"},
          ].map(b => (
            <div key={b.label} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:20,width:28}}>{b.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{b.label}</div>
                <div style={{fontSize:11,color:"#080808",marginTop:1}}>{b.desc}</div>
              </div>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:15,color:"var(--acc)",whiteSpace:"nowrap"}}>{b.pts}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
