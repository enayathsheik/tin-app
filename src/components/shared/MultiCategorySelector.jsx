import { useState } from "react";
import { CATEGORY_TREE } from "../../data/constants";

export function MultiCategorySelector({ selected, onChange }) {
  const [catSelections, setCatSelections] = useState(
    (selected||[]).reduce((acc,s) => ({
      ...acc,
      [s.category]: {
        subs: s.subCategory ? s.subCategory.split(",").map(x=>x.trim()) : [],
        prods: s.productType ? s.productType.split(",").map(x=>x.trim()) : [],
        customSub: "", customProd: "",
      }
    }), {})
  );
  const [customCat, setCustomCat] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);

  const emit = (next) => onChange(Object.keys(next).map(c => ({
    category: c,
    subCategory: (next[c].subs||[]).join(", "),
    productType: (next[c].prods||[]).join(", "),
  })));

  const toggleCat = (cat) => {
    const next = {...catSelections};
    if (next[cat]) { delete next[cat]; } else { next[cat] = {subs:[],prods:[],customSub:"",customProd:""}; }
    setCatSelections(next); emit(next);
  };
  const toggleSub = (cat, sub) => {
    const subs = (catSelections[cat]?.subs||[]).includes(sub)
      ? (catSelections[cat]?.subs||[]).filter(s=>s!==sub)
      : [...(catSelections[cat]?.subs||[]), sub];
    const next = {...catSelections, [cat]: {...catSelections[cat], subs}};
    setCatSelections(next); emit(next);
  };
  const toggleProd = (cat, prod) => {
    const prods = (catSelections[cat]?.prods||[]).includes(prod)
      ? (catSelections[cat]?.prods||[]).filter(p=>p!==prod)
      : [...(catSelections[cat]?.prods||[]), prod];
    const next = {...catSelections, [cat]: {...catSelections[cat], prods}};
    setCatSelections(next); emit(next);
  };
  const addCustomSub = (cat) => {
    const val = (catSelections[cat]?.customSub||"").trim();
    if (!val) return;
    const subs = [...(catSelections[cat]?.subs||[]), val+" (custom)"];
    const next = {...catSelections, [cat]: {...catSelections[cat], subs, customSub:""}};
    setCatSelections(next); emit(next);
  };
  const addCustomProd = (cat) => {
    const val = (catSelections[cat]?.customProd||"").trim();
    if (!val) return;
    const prods = [...(catSelections[cat]?.prods||[]), val+" (custom)"];
    const next = {...catSelections, [cat]: {...catSelections[cat], prods, customProd:""}};
    setCatSelections(next); emit(next);
  };
  const addCustomCat = () => {
    const val = customCat.trim();
    if (!val) return;
    const label = val+" (custom)";
    const next = {...catSelections, [label]: {subs:[],prods:[],customSub:"",customProd:""}};
    setCatSelections(next); emit(next);
    setCustomCat(""); setShowCustomCat(false);
  };

  const selectedCats = Object.keys(catSelections);

  return (
    <div>
      <div style={{fontSize:11,color:"#555",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Select all categories this store carries</div>
      <div className="mcat-grid">
        {Object.keys(CATEGORY_TREE).map(cat=>(
          <div key={cat} className={`mcat-item ${catSelections[cat]?"on":""}`} onClick={()=>toggleCat(cat)}>
            <div className="mcat-label">{cat}</div>
            <div className="mcat-count">{Object.keys(CATEGORY_TREE[cat]).length} sub-types</div>
          </div>
        ))}
        <div className="mcat-item" style={{borderStyle:"dashed",cursor:"pointer"}} onClick={()=>setShowCustomCat(true)}>
          <div className="mcat-label" style={{color:"#e85a2a"}}>+ Add Custom</div>
          <div className="mcat-count">Not in list?</div>
        </div>
      </div>
      {showCustomCat&&(
        <div style={{background:"#fff8f5",border:"1px solid #fde0d0",borderRadius:8,padding:12,marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
          <input className="fi" style={{flex:1,fontSize:12}} placeholder="Enter category name..." value={customCat} onChange={e=>setCustomCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomCat()} />
          <button onClick={addCustomCat} style={{padding:"7px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add</button>
          <button onClick={()=>setShowCustomCat(false)} style={{padding:"7px 10px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#555",fontSize:12,cursor:"pointer"}}>✕</button>
        </div>
      )}
      {selectedCats.length>0&&(
        <div>
          <div style={{fontSize:11,color:"#555",margin:"12px 0 8px",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Select sub-categories and products — tick all that apply</div>
          {selectedCats.map(cat=>{
            const subs = CATEGORY_TREE[cat] ? Object.keys(CATEGORY_TREE[cat]) : [];
            const curSubs = catSelections[cat]?.subs||[];
            const allProds = curSubs.flatMap(s => (CATEGORY_TREE[cat]?.[s]||[]));
            const curProds = catSelections[cat]?.prods||[];
            return(
              <div key={cat} className="mcat-expanded">
                <div className="mcat-exp-title">
                  <span>📦 {cat.replace(" (custom)","")}{cat.includes("(custom)")&&<span style={{fontSize:10,color:"#e85a2a",marginLeft:6,fontWeight:400}}>Pending admin review</span>}</span>
                  <span style={{fontSize:11,color:"#888",fontWeight:400,cursor:"pointer"}} onClick={()=>toggleCat(cat)}>× remove</span>
                </div>
                {subs.length>0&&<>
                  <div style={{fontSize:11,color:"#555",marginBottom:5,fontWeight:600}}>Sub-categories — select multiple ✓</div>
                  <div className="mcat-sub-row" style={{marginBottom:8}}>
                    {subs.map(s=><div key={s} className={`mcat-sub ${curSubs.includes(s)?"on":""}`} onClick={()=>toggleSub(cat,s)}>{s}</div>)}
                    {curSubs.filter(s=>s.includes("(custom)")).map(s=><div key={s} className="mcat-sub on" style={{borderStyle:"dashed"}}>{s.replace(" (custom)","")}</div>)}
                  </div>
                </>}
                <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
                  <input className="fi" style={{fontSize:11,padding:"5px 8px",flex:1}} placeholder="+ Add custom sub-category..." value={catSelections[cat]?.customSub||""} onChange={e=>{const n={...catSelections,[cat]:{...catSelections[cat],customSub:e.target.value}};setCatSelections(n);}} onKeyDown={e=>e.key==="Enter"&&addCustomSub(cat)} />
                  <button onClick={()=>addCustomSub(cat)} style={{padding:"5px 10px",borderRadius:6,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Add</button>
                </div>
                {allProds.length>0&&<>
                  <div style={{fontSize:11,color:"#555",marginBottom:5,fontWeight:600}}>Product types — select multiple ✓</div>
                  <div className="mcat-sub-row" style={{marginBottom:8}}>
                    {allProds.map(p=><div key={p} className={`mcat-prod ${curProds.includes(p)?"on":""}`} onClick={()=>toggleProd(cat,p)}>{p}</div>)}
                    {curProds.filter(p=>p.includes("(custom)")).map(p=><div key={p} className="mcat-prod on" style={{borderStyle:"dashed"}}>{p.replace(" (custom)","")}</div>)}
                  </div>
                </>}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="fi" style={{fontSize:11,padding:"5px 8px",flex:1}} placeholder="+ Add custom product type..." value={catSelections[cat]?.customProd||""} onChange={e=>{const n={...catSelections,[cat]:{...catSelections[cat],customProd:e.target.value}};setCatSelections(n);}} onKeyDown={e=>e.key==="Enter"&&addCustomProd(cat)} />
                  <button onClick={()=>addCustomProd(cat)} style={{padding:"5px 10px",borderRadius:6,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Add</button>
                </div>
              </div>
            );
          })}
          <div style={{paddingTop:6,display:"flex",flexWrap:"wrap"}}>
            {selectedCats.map(c=>(
              <div key={c} className="sel-cat-tag">
                {c.replace(" (custom)","")}
                {catSelections[c]?.subs?.length>0&&<span style={{opacity:.7}}> · {catSelections[c].subs.length} sub</span>}
                <span className="sel-cat-x" onClick={()=>toggleCat(c)}>×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
