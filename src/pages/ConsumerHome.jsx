export function ConsumerHome({ user, onDiscover, onBrowseCategory }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "there").split(" ")[0];

  const cards = [
    { icon: "🔍", title: "Discover Stores", desc: "Browse verified building materials stores near you.", action: onDiscover, cta: "Discover →" },
    { icon: "🏷", title: "Browse by Category", desc: "Explore stores organised by product category.", action: onBrowseCategory, cta: "Browse →" },
  ];

  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{maxWidth:720,margin:"0 auto",padding:"20px 16px 80px"}}>

        {/* HERO */}
        <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:20,marginBottom:12}}>
          <div style={{fontSize:19,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6,color:"var(--t1)"}}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{fontSize:13,color:"var(--t3)",lineHeight:1.5}}>
            Find the right building materials store near you — from tiles to hardware to paint.
          </div>
        </div>

        {/* QUICK ACCESS CARDS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
          {cards.map(c => (
            <div key={c.title} onClick={c.action} style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:20,cursor:"pointer",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{width:44,height:44,borderRadius:"var(--r)",background:"#fff0eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{c.icon}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:"var(--t1)"}}>{c.title}</div>
              <div style={{fontSize:12,color:"var(--t3)",lineHeight:1.5,flex:1}}>{c.desc}</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--acc)"}}>{c.cta}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
