import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CONTRIBUTOR_LEVELS, ROLES } from "../data/constants";
import { getLevel } from "../utils/helpers";

export function ProfilePage({ user, onUpdateUser }) {
  const lv = getLevel(user.points);
  const nextLv = CONTRIBUTOR_LEVELS.find(l => l.min > user.points);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileForm, setProfileForm] = useState({
    linkedin: user.linkedin || "",
    youtube: user.youtube || "",
    instagram: user.instagram || "",
    bio: user.bio || "",
    city: user.city || "",
    phone: user.phone || "",
    company: user.company || "",
    specialization: user.specialization || "",
  });

  const upd = (k, v) => setProfileForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user.uid) {
        await updateDoc(doc(db, "users", user.uid), profileForm);
      }
      if (onUpdateUser) onUpdateUser({ ...user, ...profileForm });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { console.log("Profile save error:", e); }
    setSaving(false);
  };

  const acts = [
    { text: `Added ${user.storesAdded || 1} store${(user.storesAdded || 1) > 1 ? "s" : ""} recently`, pts: `+${(user.storesAdded || 1) * 10} pts`, time: "Today" },
    { text: "Joined Trade Interface Network", pts: "Welcome!", time: "Account created" },
  ];

  return (
    <div className="prof-pg">
      <div className="prof-wrap">
        <div className="prof-hero">
          <div className="prof-top">
            <div className="prof-av">{user.name.charAt(0).toUpperCase()}</div>
            <div style={{flex:1}}>
              <div className="prof-name">{user.name}</div>
              <div className="prof-role">{ROLES.find(r => r.id === user.role)?.label || user.role}</div>
              <div className="prof-lbadge" style={{ background: lv.bg, color: lv.color, border: `1px solid ${lv.color}30` }}>◆ {lv.name} Contributor</div>
            </div>
            <button onClick={() => setEditing(!editing)} style={{padding:"6px 14px",borderRadius:8,background: editing?"#f5f5f5":"#080808",border:"1px solid #e0e0e0",color:editing?"#080808":"white",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
              {editing ? "Cancel" : "✏️ Edit Profile"}
            </button>
          </div>

          {/* SOCIAL LINKS DISPLAY */}
          {!editing && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {(user.linkedin||profileForm.linkedin) && <a href={(user.linkedin||profileForm.linkedin).startsWith("http")?(user.linkedin||profileForm.linkedin):`https://${user.linkedin||profileForm.linkedin}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#1D4ED8",fontSize:12,fontWeight:700,textDecoration:"none"}}>🔗 LinkedIn</a>}
              {(user.instagram||profileForm.instagram) && <a href={`https://instagram.com/${(user.instagram||profileForm.instagram).replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:"#FDF4FF",border:"1px solid #E9D5FF",color:"#7C3AED",fontSize:12,fontWeight:700,textDecoration:"none"}}>📸 Instagram</a>}
              {(user.youtube||profileForm.youtube) && <a href={(user.youtube||profileForm.youtube).startsWith("http")?(user.youtube||profileForm.youtube):`https://${user.youtube||profileForm.youtube}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12,fontWeight:700,textDecoration:"none"}}>▶ YouTube</a>}
            </div>
          )}

          {/* EDIT FORM */}
          {editing && (
            <div style={{background:"#f8f8f8",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #e0e0e0"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:"#080808",marginBottom:12}}>Edit Profile</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                {[
                  ["Phone","phone","Your mobile number"],
                  ["City","city","Your city"],
                  ["Company / Firm","company","Company name"],
                  ["Specialization","specialization","e.g. Tiles, Plywood"],
                ].map(([label,key,ph]) => (
                  <div key={key}>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                    <input className="fi" style={{fontSize:12}} placeholder={ph} value={profileForm[key]||""} onChange={e=>upd(key,e.target.value)} />
                  </div>
                ))}
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>Bio / About</div>
                <textarea className="fta" rows={2} placeholder="Brief intro about yourself and your expertise..." value={profileForm.bio||""} onChange={e=>upd("bio",e.target.value)} style={{fontSize:12}} />
              </div>
              {/* ENRICHMENT SECTION */}
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:12,marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#1D4ED8",marginBottom:8}}>🔗 Profile Enrichment — Social & Professional Links</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>LinkedIn Profile URL</div>
                    <input className="fi" style={{fontSize:12}} placeholder="linkedin.com/in/yourname" value={profileForm.linkedin||""} onChange={e=>upd("linkedin",e.target.value)} />
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>Instagram Handle</div>
                    <input className="fi" style={{fontSize:12}} placeholder="@yourinstagram or instagram.com/yourname" value={profileForm.instagram||""} onChange={e=>upd("instagram",e.target.value)} />
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>YouTube Channel</div>
                    <input className="fi" style={{fontSize:12}} placeholder="youtube.com/@yourchannel or channel URL" value={profileForm.youtube||""} onChange={e=>upd("youtube",e.target.value)} />
                  </div>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} style={{padding:"9px 20px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {saving?"Saving...":"Save Changes →"}
              </button>
              {saved && <span style={{marginLeft:10,color:"#16a34a",fontSize:13,fontWeight:600}}>✓ Saved!</span>}
            </div>
          )}

          <div className="prof-grid">
            <div className="prof-stat"><div className="prof-sv" style={{ color: "var(--acc)" }}>{user.points}</div><div className="prof-sl">Points</div></div>
            <div className="prof-stat"><div className="prof-sv">{user.storesAdded}</div><div className="prof-sl">Stores Added</div></div>
            <div className="prof-stat"><div className="prof-sv">{user.citiesCovered}</div><div className="prof-sl">Cities</div></div>
          </div>
        </div>
        <div className="prog-sec">
          <div className="prog-title">Market Champion Progress</div>
          {CONTRIBUTOR_LEVELS.map(l => {
            const isNow = user.points >= l.min && user.points <= l.max;
            const pct = user.points >= l.max ? 100 : user.points >= l.min ? Math.round(((user.points - l.min) / ((l.max === Infinity ? l.min * 5 : l.max) - l.min)) * 100) : 0;
            return (
              <div key={l.name} className="lv-row">
                <div className="lv-name" style={{ color: isNow ? l.color : "var(--t3)", fontWeight: isNow ? 700 : 400 }}>{l.name}</div>
                <div className="lv-bar"><div className="lv-fill" style={{ width: `${Math.min(pct, 100)}%`, background: l.color, opacity: isNow ? 1 : 0.3 }} /></div>
                <div className="lv-pts">{l.min === 0 ? "0" : l.min.toLocaleString()}{l.max === Infinity ? "+" : ""}</div>
              </div>
            );
          })}
          {nextLv && <div style={{ fontSize: "12px", color: "var(--t2)", marginTop: 10, textAlign: "center" }}>
            {nextLv.min - user.points} more points to reach <span style={{ color: nextLv.color, fontWeight: 700 }}>{nextLv.name}</span>
          </div>}
        </div>
        <div className="act-sec">
          <div className="act-title">Activity</div>
          {acts.map((a, i) => (
            <div key={i} className="act-item">
              <div className="act-dot" />
              <div style={{ flex: 1 }}><div className="act-text">{a.text}</div><div className="act-meta">{a.time}</div></div>
              <div className="act-pts">{a.pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
