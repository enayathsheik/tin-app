import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/config";
import { extractPincodeFromText, validatePincode } from "../../utils/helpers";

export function BulkUploadPanel() {
  const [uploadType, setUploadType] = useState("store"); // store / contractor / architect
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [errors, setErrors] = useState([]);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState("paste");

  const TYPE_CONFIG = {
    store: {
      label: "🏪 Stores / Retailers",
      collection: "stores",
      templateCols: "storeName,phone,whatsapp,address,city,state,pincode,businessType,ownerName,email,gst,brands,instagram,website,categories,googleRating,googleReviewCount,placeId",
      templateRows: `Top Tiles World,9886984575,9886984575,"Shop No 2, MG Road, Bengaluru 560001",Bengaluru,Karnataka,560001,Retailer,Rajesh,,29ARAPD8170D1Z0,,,,Flooring,,,
ABC Hardware,9820012345,,,Mumbai,Maharashtra,400001,Distributor,Suresh,,,Hettich,,,Hardware & Fittings,4.5,120,ChIJoRQI-YzP5zsRUkUUmHE_GUM`,
    },
    contractor: {
      label: "🔧 Contractors",
      collection: "contractors",
      templateCols: "name,phone,whatsapp,email,city,state,pincode,specialization,company,experience,website",
      templateRows: `Rajesh Kumar,9820012345,9820012345,rajesh@gmail.com,Mumbai,Maharashtra,400001,Civil Contractor,Kumar Constructions,10 years,
Suresh Patel,9876543210,,suresh@gmail.com,Pune,Maharashtra,411001,Interior Contractor,Patel Interiors,5 years,`,
    },
    architect: {
      label: "✏️ Architects / Designers",
      collection: "architects",
      templateCols: "name,phone,whatsapp,email,city,state,pincode,specialization,firm,experience,linkedin,website",
      templateRows: `Anita Sharma,9820012345,9820012345,anita@gmail.com,Mumbai,Maharashtra,400001,Residential Design,Sharma Associates,8 years,,www.sharma.com
Vikram Nair,9876543210,,vikram@gmail.com,Bengaluru,Karnataka,560001,Commercial Design,Nair Design Studio,12 years,linkedin.com/in/vikram,`,
    },
  };

  // Returns a finite number or undefined (keeps optional numeric fields nullable)
  const toFiniteNumber = (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  // Proper CSV parser that handles quoted fields with commas
  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text) => {
    // Normalize line endings
    const normalized = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    // Handle multiline quoted fields by joining them
    const lines = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === '"') { inQuotes = !inQuotes; current += ch; }
      else if (ch === '\n' && !inQuotes) { lines.push(current); current = ""; }
      else { current += ch; }
    }
    if (current) lines.push(current);

    if (lines.length < 2) return [];
    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g,""));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseCSVLine(lines[i]);
      if (vals.filter(v=>v).length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx]||"").trim(); });
      // Map to standard field names
      const address = row.address || row.addr || "";
      const rawPincode = row.pincode || row.pin || "";
      // Auto-extract pincode from address if not present
      const pincode = rawPincode || extractPincodeFromText(address);
      const pincodeResult = validatePincode(pincode);
      const store = {
        storeName: row.storename || row.store_name || row.storeName || "",
        name: row.name || row.storename || row.store_name || "",
        phone: row.phone || row.mobile || row.contact || "",
        whatsapp: row.whatsapp || row.phone || row.mobile || "",
        address: address,
        city: row.city || row.location || "",
        state: row.state || pincodeResult.state || "",
        pincode: pincode,
        businessType: row.businesstype || row.business_type || row.type || "Retailer",
        ownerName: row.ownername || row.owner || row.owner_name || "",
        email: row.email || "",
        gst: row.gst || row.gstin || "",
        brands: row.brands || row.brand || "",
        instagram: row.instagram || row.ig || "",
        website: row.website || row.web || "",
        categories: row.categories || row.category || "",
        googleRating: row.googlerating || row.rating || "",
        googleReviewCount: row.googlereviewcount || row.reviewcount || "",
        placeId: row.placeid || "",
        _pincodeExtracted: !rawPincode && !!pincode,
      };
      if (store.storeName) rows.push(store);
    }
    return rows;
  };

  const handlePreview = () => {
    const rows = parseCSV(csvText);
    setPreview(rows);
    setErrors([]);
    setDone(false);
  };

  const handleUpload = async () => {
    if (!preview.length) return;
    setUploading(true);
    setUploaded(0);
    const errs = [];
    let count = 0;

    for (const row of preview) {
      try {
        const googleRating = toFiniteNumber(row.googleRating);
        const googleReviewCount = toFiniteNumber(row.googleReviewCount);
        await addDoc(collection(db, cfg.collection), {
          // Store fields
          ...(uploadType === "store" ? {
            storeName: row.storeName || "",
            phone: row.phone || "",
            whatsapp: row.whatsapp || row.phone || "",
            address: row.address || "",
            city: row.city || "",
            state: row.state || "",
            pincode: row.pincode || "",
            businessType: row.businessType || "Retailer",
            ownerName: row.ownerName || "",
            email: row.email || "",
            gst: row.gst || "",
            brands: row.brands || "",
            instagram: row.instagram || "",
            website: row.website || "",
            categories: row.categories ? [{category: row.categories, subCategory:"", productType:""}] : [],
            ...(googleRating !== undefined ? { googleRating } : {}),
            ...(googleReviewCount !== undefined ? { googleReviewCount } : {}),
            ...(row.placeId ? { placeId: row.placeId } : {}),
            verificationStatus: "community_added",
            pointsAwarded: 0,
            confidence: 60,
          } : {}),
          // Contractor/Architect fields
          ...(uploadType !== "store" ? {
            name: row.name || row.storeName || "",
            phone: row.phone || "",
            whatsapp: row.whatsapp || row.phone || "",
            email: row.email || "",
            city: row.city || "",
            state: row.state || "",
            pincode: row.pincode || "",
            specialization: row.specialization || "",
            company: row.company || row.firm || "",
            experience: row.experience || "",
            linkedin: row.linkedin || "",
            website: row.website || "",
            type: uploadType,
            verificationStatus: "community_added",
          } : {}),
          contributorId: auth.currentUser?.uid || "admin",
          contributorEmail: auth.currentUser?.email || "enayathsheik@gmail.com",
          source: "bulk_upload",
          createdAt: serverTimestamp(),
        });
        count++;
        setUploaded(count);
      } catch(e) {
        errs.push(`Row ${count+1} (${row.storeName}): ${e.message}`);
      }
    }
    setErrors(errs);
    setUploading(false);
    setDone(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const cfg = TYPE_CONFIG[uploadType];

  const downloadTemplate = () => {
    const csv = cfg.templateCols + "\n" + cfg.templateRows;
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TIN_${uploadType}_template.csv`; a.click();
  };

  return (
    <div style={{padding:24,maxWidth:900,margin:"0 auto"}}>

      {/* TYPE SELECTOR */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {Object.entries(TYPE_CONFIG).map(([id,c])=>(
          <button key={id} onClick={()=>{setUploadType(id);setCsvText("");setPreview([]);setDone(false);}}
            style={{padding:"9px 18px",borderRadius:8,background:uploadType===id?"#080808":"#f5f5f5",color:uploadType===id?"white":"#080808",border:`1px solid ${uploadType===id?"#080808":"#e0e0e0"}`,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {c.label}
          </button>
        ))}
      </div>
      <div style={{fontSize:12,color:"#555",marginBottom:16,padding:"8px 12px",background:"#f8f8f8",borderRadius:8}}>
        Uploading to: <strong style={{color:"#e85a2a"}}>Firebase → {cfg.collection}</strong> collection
      </div>

      {/* INPUT TABS */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["paste","📋 Paste CSV"],["file","📁 Upload File"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:"7px 14px",borderRadius:8,background:tab===id?"#e85a2a":"#f5f5f5",color:tab===id?"white":"#080808",border:`1px solid ${tab===id?"#e85a2a":"#e0e0e0"}`,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {label}
          </button>
        ))}
        <button onClick={downloadTemplate} style={{padding:"7px 14px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>📥 Download Template</button>
      </div>

      {/* FORMAT GUIDE */}
      <div style={{background:"#f8f8f8",border:"1px solid #e0e0e0",borderRadius:10,padding:14,marginBottom:16,fontSize:12,color:"#080808"}}>
        <div style={{fontWeight:700,marginBottom:6}}>📋 CSV Columns for {cfg.label}</div>
        <div style={{fontFamily:"monospace",fontSize:11,color:"#e85a2a",lineHeight:1.8,wordBreak:"break-all"}}>{cfg.templateCols}</div>
        <div style={{marginTop:6,color:"#555"}}>• First row must be headers exactly as shown above</div>
        <div style={{color:"#555"}}>• Pincode is auto-extracted from address if not provided</div>
      </div>

      {/* INPUT */}
      {tab === "paste" && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#080808",marginBottom:6}}>Paste CSV Data</div>
          <textarea
            className="fta"
            rows={10}
            placeholder={"storeName,phone,address,city,state,pincode,businessType,ownerName,brands,categories\nABC Store,9820012345,123 MG Road,Mumbai,Maharashtra,400001,Retailer,Rajesh,Hettich,Hardware & Fittings"}
            value={csvText}
            onChange={e=>setCsvText(e.target.value)}
            style={{fontFamily:"monospace",fontSize:11}}
          />
        </div>
      )}
      {tab === "file" && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#080808",marginBottom:6}}>Upload CSV File</div>
          <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
            style={{padding:"10px",border:"2px dashed #e0e0e0",borderRadius:8,width:"100%",cursor:"pointer",fontSize:13}} />
          {csvText && <div style={{fontSize:12,color:"#16a34a",marginTop:6}}>✓ File loaded — {csvText.split("\n").length} lines</div>}
        </div>
      )}

      {/* PREVIEW BUTTON */}
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <button onClick={handlePreview} style={{padding:"9px 20px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          👁 Preview Data
        </button>
        {preview.length>0 && !uploading && !done && (
          <button onClick={handleUpload} style={{padding:"9px 20px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            📤 Upload {preview.length} {uploadType==="store"?"Stores":uploadType==="contractor"?"Contractors":"Architects"} to Firebase
          </button>
        )}
      </div>

      {/* UPLOAD PROGRESS */}
      {uploading && (
        <div style={{background:"#fff8f5",border:"1px solid #fde0d0",borderRadius:10,padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,color:"#e85a2a",marginBottom:8}}>Uploading... {uploaded} / {preview.length}</div>
          <div style={{height:8,background:"#f0f0f0",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#e85a2a",borderRadius:4,width:`${Math.round((uploaded/preview.length)*100)}%`,transition:"width .3s"}}/>
          </div>
        </div>
      )}

      {/* DONE */}
      {done && (
        <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,color:"#16a34a",fontSize:15}}>✅ Upload Complete!</div>
          <div style={{fontSize:13,color:"#080808",marginTop:4}}>{uploaded} {uploadType==="store"?"stores":uploadType==="contractor"?"contractors":"architects"} uploaded to Firebase → <strong>{cfg.collection}</strong> collection.</div>
          {errors.length>0 && <div style={{marginTop:8,fontSize:12,color:"#dc2626"}}>{errors.length} errors — {errors[0]}</div>}
          <button onClick={()=>{setDone(false);setCsvText("");setPreview([]);setUploaded(0);}} style={{marginTop:10,padding:"7px 14px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Upload Another Batch</button>
        </div>
      )}

      {/* PREVIEW TABLE */}
      {preview.length>0 && (
        <div>
          <div style={{fontWeight:700,color:"#080808",marginBottom:8,fontSize:14}}>Preview — {preview.length} stores found</div>
          <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e0e0e0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#f8f8f8"}}>
                  {["#","Store Name","Phone","City","State","Pincode","Business Type","Status"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#080808",borderBottom:"1px solid #e0e0e0",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0,50).map((row,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #f0f0f0",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"7px 12px",color:"#555"}}>{i+1}</td>
                    <td style={{padding:"7px 12px",fontWeight:600,color:"#080808"}}>{(uploadType==="store"?row.storeName:row.name)||<span style={{color:"#dc2626"}}>⚠ Missing</span>}</td>
                    <td style={{padding:"7px 12px",color:"#080808"}}>{row.phone||"—"}</td>
                    <td style={{padding:"7px 12px",color:"#080808"}}>{row.city||"—"}</td>
                    <td style={{padding:"7px 12px",color:"#080808"}}>{row.state||"—"}</td>
                    <td style={{padding:"7px 12px",color:"#080808"}}>
                      {row.pincode
                        ? <span style={{color:row._pincodeExtracted?"#d97706":"#080808"}}>{row.pincode}{row._pincodeExtracted&&" ✨"}</span>
                        : "—"}
                    </td>
                    <td style={{padding:"7px 12px",color:"#080808"}}>{row.businessType||"Retailer"}</td>
                    <td style={{padding:"7px 12px"}}><span style={{fontSize:10,fontWeight:700,background:"#f0fdf4",color:"#16a34a",padding:"2px 8px",borderRadius:10}}>Ready</span></td>
                  </tr>
                ))}
                {preview.length>50 && <tr><td colSpan={8} style={{padding:"8px 12px",textAlign:"center",color:"#555",fontSize:12}}>... and {preview.length-50} more stores</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
