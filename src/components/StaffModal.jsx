export function StaffModal({ staff, onClose }) {
  if(!staff) return null;
  return(
    <div style={{position:"fixed",inset:0,background:"#00000085",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"var(--s1)",border:"1px solid var(--b3)",borderRadius:"var(--rxl)",padding:26,maxWidth:500,width:"100%",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <div className="staff-av" style={{width:46,height:46,fontSize:17}}>{staff.name.charAt(0)}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:19}}>{staff.name}</div>
            <div style={{fontSize:13,color:"#080808"}}>{staff.designation}</div>
          </div>
          <button className="btn-sm btn-out" onClick={onClose}>✕</button>
        </div>
        <div className="skills-row" style={{marginBottom:16}}>
          {staff.skills.map(s=><div key={s} className="skill-tag">{s}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          {[["Work Email",staff.workEmail],["Personal Email",staff.personalEmail],["Phone",staff.phone],["LinkedIn",staff.linkedin||"—"]].map(([l,v])=>(
            <div key={l} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:10}}>
              <div style={{fontSize:10,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div>
              <div style={{fontSize:12,fontWeight:500}}>{v||"—"}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#080808",marginBottom:12}}>Work History</div>
        <div className="wh-timeline">
          {staff.workHistory.map((w,i)=>(
            <div key={i} className="wh-entry">
              <div className="wh-card">
                <div className="wh-card-role">{w.role}</div>
                <div className="wh-card-store">{w.store}</div>
                <div className="wh-card-period">{w.from} – {w.to} · {w.city}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
