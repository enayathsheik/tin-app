import { useState } from "react";
import { CITIES } from "../data/constants";

export function StaffProfilePage({ user }) {
  const [form, setForm] = useState({name:user.name||"",designation:"",storeName:"",workEmail:user.workEmail||"",personalEmail:user.personalEmail||"",phone:"",linkedin:user.linkedin||"",skills:"",city:""});
  const [history, setHistory] = useState([{store:"",role:"",from:"",to:"",city:""}]);
  const [saved, setSaved] = useState(false);
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const updH=(i,k,v)=>setHistory(h=>h.map((e,idx)=>idx===i?{...e,[k]:v}:e));

  return(
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px 60px"}}>
        <div style={{marginBottom:22}}>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:28,marginBottom:4}}>Staff Profile</div>
          <div style={{color:"#080808",fontSize:13}}>Build your professional identity in the building materials industry</div>
        </div>
        {saved&&<div className="val-ok-banner"><span>✓</span><div>Profile saved! It will appear under the store's Team section after verification.</div></div>}
        <div className="sec">
          <div className="sec-hd">Personal Details</div>
          <div className="fg">
            <div className="field"><label className="fl">Full Name</label><input className="fi" value={form.name} onChange={e=>upd("name",e.target.value)}/></div>
            <div className="field"><label className="fl">Current Designation</label><input className="fi" placeholder="e.g. Sales Manager" value={form.designation} onChange={e=>upd("designation",e.target.value)}/></div>
            <div className="field"><label className="fl">Work Email <span className="req">*</span></label><input className="fi" placeholder="you@company.com" value={form.workEmail} onChange={e=>upd("workEmail",e.target.value)}/></div>
            <div className="field"><label className="fl">Personal Email</label><input className="fi" placeholder="you@gmail.com" value={form.personalEmail} onChange={e=>upd("personalEmail",e.target.value)}/></div>
            <div className="field"><label className="fl">Phone</label><input className="fi" placeholder="Mobile number" value={form.phone} onChange={e=>upd("phone",e.target.value)}/></div>
            <div className="field"><label className="fl">LinkedIn</label><input className="fi" placeholder="linkedin.com/in/..." value={form.linkedin} onChange={e=>upd("linkedin",e.target.value)}/></div>
            <div className="field" style={{gridColumn:"1/-1"}}><label className="fl">Skills & Expertise</label><input className="fi" placeholder="Hardware, Architectural Fittings, B2B Sales (comma separated)" value={form.skills} onChange={e=>upd("skills",e.target.value)}/></div>
          </div>
        </div>
        <div className="sec">
          <div className="sec-hd">Current Store / Company</div>
          <div className="fg">
            <div className="field"><label className="fl">Store / Company Name</label><input className="fi" placeholder="Where do you currently work?" value={form.storeName} onChange={e=>upd("storeName",e.target.value)}/></div>
            <div className="field"><label className="fl">City</label><input className="fi" list="cities-list2" placeholder="City" value={form.city} onChange={e=>upd("city",e.target.value)}/><datalist id="cities-list2">{CITIES.map(c=><option key={c} value={c}/>)}</datalist></div>
          </div>
        </div>
        <div className="sec">
          <div className="sec-hd">Work History <span style={{color:"#080808",fontWeight:400,textTransform:"none",letterSpacing:0}}>— most recent first</span></div>
          {history.map((job,i)=>(
            <div key={i} style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:"#080808",textTransform:"uppercase",letterSpacing:".06em"}}>Position {i+1}{i===0?" (Current)":""}</div>
                {history.length>1&&<button className="btn-sm btn-out" style={{fontSize:11}} onClick={()=>setHistory(h=>h.filter((_,idx)=>idx!==i))}>Remove</button>}
              </div>
              <div className="fg" style={{gap:10}}>
                <div className="field"><label className="fl">Store / Company</label><input className="fi" placeholder="Company name" value={job.store} onChange={e=>updH(i,"store",e.target.value)}/></div>
                <div className="field"><label className="fl">Role</label><input className="fi" placeholder="Your role" value={job.role} onChange={e=>updH(i,"role",e.target.value)}/></div>
                <div className="field"><label className="fl">From Year</label><input className="fi" placeholder="2018" value={job.from} onChange={e=>updH(i,"from",e.target.value)}/></div>
                <div className="field"><label className="fl">To Year</label><input className="fi" placeholder="2021 or Present" value={job.to} onChange={e=>updH(i,"to",e.target.value)}/></div>
                <div className="field"><label className="fl">City</label><input className="fi" placeholder="City" value={job.city} onChange={e=>updH(i,"city",e.target.value)}/></div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{fontSize:13,padding:"8px 16px"}} onClick={()=>setHistory(h=>[...h,{store:"",role:"",from:"",to:"",city:""}])}>+ Add Previous Job</button>
        </div>
        <button className="btn btn-primary" style={{width:"100%",padding:14,fontSize:15,borderRadius:"var(--r)"}} onClick={()=>setSaved(true)}>Save Staff Profile →</button>
      </div>
    </div>
  );
}
