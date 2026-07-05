import { CONTRIBUTOR_LEVELS } from "../data/constants";
import { getLevel } from "../utils/helpers";

export function MarketChampionHome({ user, contributors, onAddStore, onLeaderboard, onRewards, onDiscover }) {
  const points = user.points || 0;
  const storesAdded = user.storesAdded || 0;
  const citiesCovered = user.citiesCovered || 0;
  const streak = user.streak || 0;
  const lv = getLevel(points);
  const nextLv = CONTRIBUTOR_LEVELS.find(l => l.min > points);
  const nextMin = nextLv ? nextLv.min : lv.max;
  const ptsToNext = nextLv ? nextLv.min - points : 0;
  const pct = nextLv ? Math.min(Math.round(((points - lv.min) / (nextLv.min - lv.min)) * 100), 100) : 100;

  const sorted = [...contributors].sort((a, b) => b.points - a.points);
  const myRank = sorted.findIndex(c => c.id === user.uid || c.name === user.name) + 1 || 34;
  const top3 = sorted.slice(0, 3);
  const avColors = ["#E6F1FB","#EAF3DE","#FAEEDA","#EEEDFE","#FAECE7"];
  const avText = ["#0C447C","#27500A","#633806","#3C3489","#712B13"];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || "Champion").split(" ")[0];

  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{maxWidth:720,margin:"0 auto",padding:"20px 16px 80px"}}>

        {/* HERO */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:20,marginBottom:12}}>
          <div style={{fontSize:19,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:14,color:"var(--t1)"}}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
            {[
              {icon:"🏆",label:"Level",value:lv.name+" Builder",color:lv.color},
              {icon:"⭐",label:"Total points",value:points.toLocaleString()+" pts",color:"var(--ok)"},
              {icon:"🏅",label:"State rank",value:`#${myRank} Maharashtra`,color:"var(--info)"},
              {icon:"🔥",label:"Streak",value:streak+" days",color:"var(--warn)"},
            ].map(s => (
              <div key={s.label} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"10px 12px"}}>
                <div style={{fontSize:16,marginBottom:3}}>{s.icon}</div>
                <div style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>{s.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:"var(--t1)"}}>
                {nextLv ? `${ptsToNext} points to ${nextLv.name} Builder` : "Max level reached — Legend 🌟"}
              </span>
              <span style={{fontSize:11,color:"var(--t3)"}}>{points} / {nextLv ? nextMin : points}</span>
            </div>
            <div style={{height:8,background:"var(--b2)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
              <div style={{height:"100%",width:`${pct}%`,background:lv.color,borderRadius:99,transition:"width 1s ease"}}/>
            </div>
            <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.5}}>
              You're among Maharashtra's top contributors.{" "}
              {nextLv && <span style={{color:lv.color,fontWeight:700}}>One more contribution can take you to {nextLv.name}.</span>}
            </div>
          </div>
        </div>

        {/* ADD STORE CTA */}
        <div style={{background:"var(--s1)",border:"2px solid var(--acc)",borderRadius:"var(--rl)",padding:20,marginBottom:12,display:"flex",alignItems:"center",gap:16,cursor:"pointer"}} onClick={onAddStore}>
          <div style={{width:52,height:52,borderRadius:"var(--r)",background:"#fff0eb",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:26}}>🏪</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"var(--t1)",marginBottom:3}}>Add a Store</div>
            <div style={{fontSize:12,color:"var(--t3)",lineHeight:1.5}}>Help expand India's largest building materials discovery network. Each store earns you <strong style={{color:"var(--acc)"}}>+10 points</strong>.</div>
          </div>
          <button onClick={onAddStore} style={{background:"var(--acc)",color:"white",border:"none",borderRadius:"var(--r)",padding:"10px 18px",fontSize:14,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Barlow',sans-serif"}}>
            + Add Store
          </button>
        </div>

        {/* LEADERBOARD */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:20,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:"var(--t1)"}}>🏆 Top Contributors This Week</div>
            <span onClick={onLeaderboard} style={{fontSize:12,color:"var(--acc)",cursor:"pointer",fontWeight:700}}>Full leaderboard →</span>
          </div>
          {top3.map((c, i) => (
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:14,width:22,textAlign:"center",fontWeight:800,color:["#D4920A","#888","#A0522D"][i]}}>
                {["🥇","🥈","🥉"][i]}
              </div>
              <div style={{width:30,height:30,borderRadius:"50%",background:avColors[i%avColors.length],color:avText[i%avText.length],display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>
                {c.name.charAt(0)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{c.name}</div>
                <div style={{fontSize:11,color:"var(--t3)"}}>{c.storesAdded} stores · {c.city}</div>
              </div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:"var(--acc)"}}>{c.points.toLocaleString()}</div>
            </div>
          ))}
          <div style={{background:"var(--s2)",borderRadius:"var(--r)",padding:"12px 14px",marginTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>🏅 #{myRank} in Maharashtra <span style={{fontSize:11,background:"#E6F1FB",color:"#0C447C",borderRadius:4,padding:"2px 6px",marginLeft:4,fontWeight:700}}>You</span></div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{points.toLocaleString()} points this week</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"var(--ok)",fontWeight:700}}>↑ 5 places this week</div>
              </div>
            </div>
            <div style={{fontSize:11,color:"var(--t3)",marginTop:8}}>
              <span style={{color:"var(--info)",fontWeight:700}}>120 points</span> needed to enter Top 25 — about 12 store additions.
            </div>
          </div>
        </div>

        {/* EARN POINTS GRID */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:"var(--t1)",marginBottom:14}}>⚡ Ways to Earn Points</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
            {[
              {icon:"🏪",title:"Add a Store",desc:"List a store not yet on TIN",pts:"+10 pts",action:onAddStore},
              {icon:"✅",title:"Verify a Store",desc:"Confirm an existing listing's details",pts:"+5 pts",action:onDiscover},
              {icon:"📸",title:"Add Photos",desc:"Upload real storefront photos",pts:"+3 pts",action:onDiscover},
              {icon:"👥",title:"Refer a Contributor",desc:"Earn when they get validated",pts:"+50 pts",action:onRewards},
            ].map(t => (
              <div key={t.title} onClick={t.action||undefined} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",cursor:t.action?"pointer":"default",display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:20}}>{t.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{t.title}</div>
                <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.4}}>{t.desc}</div>
                <div style={{fontSize:12,color:"var(--ok)",fontWeight:700,marginTop:2}}>{t.pts}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
