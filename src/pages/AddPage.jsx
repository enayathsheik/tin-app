import { useState } from "react";
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { BUSINESS_TYPES, CITIES, STATES, STORE_CHECKLIST, INDIVIDUAL_CHECKLIST } from "../data/constants";
import { validatePincode } from "../utils/helpers";
import { MultiCategorySelector } from "../components/shared/MultiCategorySelector";

export function AddPage({ user, onSubmit, toast }) {
  const isContributor = user.role === "contributor";
  const canContribute = !isContributor || user.validationStatus === "active" || user.validationStatus === "pending";

  const [recType, setRecType] = useState("store");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [locating, setLocating] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [gstStatus, setGstStatus] = useState(null); // null | "checking" | "verified" | "invalid" | "error"
  const [gstData, setGstData] = useState(null);
  const [form, setForm] = useState({
    storeName: "", phone: "", address: "", city: "", state: "", pincode: "",
     businessType: "",
    ownerName: "", email: "", personalEmail: "", gst: "", brands: "", whatsapp: "", instagram: "", website: "", lat: null, lng: null,
    linkedIn: "", facebook: "", specialization: "", firmName: "",
  });

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleChk = (item) => setChecklist(c => c.includes(item) ? c.filter(x => x !== item) : [...c, item]);

  // GST Verification — uses free public GST search API
  const verifyGST = async (gstin) => {
    if (!gstin || gstin.length !== 15) return;
    setGstStatus("checking");
    setGstData(null);
    try {
      // Using the free public GSTIN lookup proxy
      const res = await fetch(`https://sheet.gstincheck.co.in/check/${gstin.toUpperCase()}`);
      const data = await res.json();
      if (data && data.flag === true && data.data) {
        const d = data.data;
        setGstData(d);
        setGstStatus("verified");
        // Auto-fill fields from GST data
        if (!form.storeName && d.lgnm) upd("storeName", d.lgnm);
        if (!form.state && d.stj) {
          const stateFromGST = d.pradr?.addr?.stcd || "";
          if (stateFromGST) upd("state", stateFromGST);
        }
        if (!form.address && d.pradr?.adr) upd("address", d.pradr.adr);
        if (!form.ownerName && d.ctb) upd("ownerName", d.ctb);
      } else {
        setGstStatus("invalid");
      }
    } catch(e) {
      setGstStatus("error");
    }
  };

  const getGPS = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      p => { upd("lat", p.coords.latitude.toFixed(6)); upd("lng", p.coords.longitude.toFixed(6)); setLocating(false); },
      () => setLocating(false), { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!form.storeName || !form.phone || !form.city) return;
    setSubmitting(true);
    try {
      // Build clean store object - no undefined values
      const storeData = {
        storeName: form.storeName || "",
        phone: form.phone || "",
        whatsapp: form.whatsapp || "",
        instagram: form.instagram || "",
        facebook: form.facebook || "",
        address: form.address || "",
        city: form.city || "",
        state: form.state || "",
        pincode: form.pincode || "",
        businessType: form.businessType || "",
        ownerName: form.ownerName || "",
        email: form.email || "",
        personalEmail: form.personalEmail || "",
        gst: form.gst || "",
        brands: form.brands || "",
        website: form.website || "",
        lat: form.lat || null,
        lng: form.lng || null,
        categories: selectedCategories || [],
        checklist: checklist || [],
        type: recType,
        contributorId: user.uid || user.email || "anonymous",
        contributorEmail: user.email || "",
        verificationStatus: "community_added",
        gstVerified: gstStatus === "verified",
        gstVerifiedData: gstData ? { legalName: gstData.lgnm, status: gstData.sts, registrationDate: gstData.rgdt, constitutionOfBusiness: gstData.ctb } : null,
        pointsAwarded: gstStatus === "verified" ? 20 : 10,
        confidence: gstStatus === "verified" ? 85 : 20,
        createdAt: serverTimestamp(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "stores"), storeData);
      console.log("Store saved:", docRef.id);

      // Update contributor points — 20 pts for GST verified, 10 for community
      if (user.uid && user.uid !== "admin") {
        await updateDoc(doc(db, "users", user.uid), {
          points: increment(gstStatus === "verified" ? 20 : 10),
          storesAdded: increment(1),
        });
      }

      onSubmit({ ...storeData, id: docRef.id, createdAt: new Date().toISOString() });
    } catch(err) {
      console.error("Store save error:", err.message);
      // Still submit locally so user flow continues
      onSubmit({ ...form, categories: selectedCategories, checklist, type: recType, contributorId: user.email, verificationStatus: "community_added", pointsAwarded: 10, createdAt: new Date().toISOString(), confidence: 20, id: Date.now().toString() });
      showToast("Saved locally — sync error: " + err.message, "err");
    }
    setSubmitting(false);
    setForm({ storeName: "", phone: "", address: "", city: "", state: "", pincode: "",  businessType: "", ownerName: "", email: "", personalEmail: "", gst: "", brands: "", whatsapp: "", instagram: "", website: "", lat: null, lng: null, linkedIn: "", facebook: "", specialization: "", firmName: "" });
    setChecklist([]);
  };

  const CL = recType === "store" ? STORE_CHECKLIST : INDIVIDUAL_CHECKLIST;
  const canSubmit = form.storeName && form.phone && form.city && !submitting;

  return (
    <div className="form-pg">
      <div className="form-wrap">
        <div className="form-hd">
          <div className="form-title">Add Trade Profile</div>
          <div className="form-sub">Help build India's building materials intelligence database</div>
        </div>
        <div className="pts-hint">🏆 +10 points for this contribution · Data enriched by community over time</div>

        <div className="type-tabs">
          {[["store","🏪","Store / Business","Retail, distribution, manufacturing"], ["individual","👤","Individual","Contractor, architect, professional"]].map(([id, icon, lbl, desc]) => (
            <div key={id} className={`type-tab ${recType === id ? "on" : ""}`} onClick={() => setRecType(id)}>
              <div className="type-tab-icon">{icon}</div>
              <div className="type-tab-label">{lbl}</div>
              <div className="type-tab-desc">{desc}</div>
            </div>
          ))}
        </div>

        <div className="sec">
          <div className="sec-hd">{recType === "store" ? "Store Details" : "Personal Details"}</div>
          <div className="fg">
            <div className="field" style={{ gridColumn: "1/-1" }}>
              <label className="fl">{recType === "store" ? "Store / Business Name" : "Full Name"} <span className="req">*</span></label>
              <input className="fi" placeholder={recType === "store" ? "e.g. Sharma Hardware & Tools" : "e.g. Amit Verma"} value={form.storeName} onChange={e => upd("storeName", e.target.value)} />
            </div>
            <div className="field">
              <label className="fl">Mobile / Phone <span className="req">*</span></label>
              <input className="fi" placeholder="10-digit mobile" value={form.phone} onChange={e => upd("phone", e.target.value)} />
            </div>
            <div className="field">
              <label className="fl">Business Type</label>
              <select className="fs" value={form.businessType} onChange={e => upd("businessType", e.target.value)}>
                <option value="">Select type</option>
                {BUSINESS_TYPES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            {recType === "individual" && <>
              <div className="field">
                <label className="fl">Firm / Company Name</label>
                <input className="fi" placeholder="Company name" value={form.firmName} onChange={e => upd("firmName", e.target.value)} />
              </div>
              <div className="field">
                <label className="fl">Specialization</label>
                <input className="fi" placeholder="e.g. Residential Interior" value={form.specialization} onChange={e => upd("specialization", e.target.value)} />
              </div>
            </>}
            {recType === "store" && <div className="field">
              <label className="fl">Owner Name</label>
              <input className="fi" placeholder="Owner's name" value={form.ownerName} onChange={e => upd("ownerName", e.target.value)} />
            </div>}
          </div>
        </div>

        <div className="sec">
          <div className="sec-hd">Categories <span style={{ color: "var(--t3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— select all that apply</span></div>
          <MultiCategorySelector selected={selectedCategories} onChange={setSelectedCategories} />
        </div>

        <div className="sec">
          <div className="sec-hd">Location <span className="req">*</span></div>
          <div className="fg" style={{ marginBottom: 10 }}>
            <div className="field">
              <label className="fl">City <span className="req">*</span></label>
              <input className="fi" list="cities-list" placeholder="City" value={form.city} onChange={e => upd("city", e.target.value)} />
              <datalist id="cities-list">{CITIES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="field">
              <label className="fl">State</label>
              <select className="fs" value={form.state} onChange={e => upd("state", e.target.value)}>
                <option value="">Select state</option>
                {STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="fl">Pincode</label>
              <input className="fi" placeholder="6-digit pincode"
                value={form.pincode}
                maxLength={6}
                onChange={e => {
                  const pin = e.target.value.replace(/[^0-9]/g,"").substring(0,6);
                  upd("pincode", pin);
                  if (pin.length === 6) {
                    const result = validatePincode(pin);
                    if (result.valid && result.state && !form.state) upd("state", result.state);
                    upd("_pincodeError", !result.valid);
                  } else {
                    upd("_pincodeError", false);
                  }
                }}
                style={{borderColor: form._pincodeError ? "#dc2626" : (form.pincode && form.pincode.length===6 && !form._pincodeError) ? "#16a34a" : ""}}
              />
              {form._pincodeError && <div style={{fontSize:11,color:"#dc2626",marginTop:2}}>⚠ Invalid pincode — please check</div>}
              {form.pincode && form.pincode.length===6 && !form._pincodeError && <div style={{fontSize:11,color:"#16a34a",marginTop:2}}>✓ Valid · {validatePincode(form.pincode).state}</div>}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="fl">Street Address</label>
            <input className="fi" placeholder="Shop no, building, street, area" value={form.address} onChange={e => upd("address", e.target.value)} />
          </div>
          <div className="loc-field">
            <div className="loc-info">
              <div className="loc-txt">{form.lat ? "GPS location captured" : "Capture GPS coordinates for accurate map pin"}</div>
              {form.lat && <div className="loc-coords">{form.lat}, {form.lng}</div>}
              {!form.lat && <div style={{ fontSize: "11px", color: "var(--t3)", marginTop: 2 }}>Stand near the store entrance</div>}
            </div>
            <button className="btn-sm btn-acc" onClick={getGPS} disabled={locating} style={{ flexShrink: 0 }}>
              {locating ? "Locating..." : form.lat ? "📍 Recapture" : "📍 Get GPS"}
            </button>
          </div>
        </div>

        <div className="sec">
          <div className="sec-hd">Business Info <span style={{ color: "var(--t3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— add as much as you know</span></div>
          <div className="fg">
            <div className="field">
              <label className="fl">Email</label>
              <input className="fi" placeholder="Business email" value={form.email} onChange={e => upd("email", e.target.value)} />
            </div>
            {recType === "store" && <div className="field" style={{gridColumn:"1/-1"}}>
              <label className="fl">GST Number <span style={{fontSize:10,color:"#555",fontWeight:400}}>(verify to get GST Verified badge + 20 pts)</span></label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input className="fi" placeholder="e.g. 27AABCS1429B1ZB" value={form.gst}
                  style={{flex:1, borderColor: gstStatus==="verified"?"#16a34a": gstStatus==="invalid"?"#dc2626":""}}
                  onChange={e => { upd("gst", e.target.value.toUpperCase()); setGstStatus(null); setGstData(null); }}
                  maxLength={15}
                />
                <button type="button"
                  onClick={() => verifyGST(form.gst)}
                  disabled={!form.gst || form.gst.length !== 15 || gstStatus === "checking"}
                  style={{padding:"9px 16px",borderRadius:8,background: form.gst?.length===15?"#080808":"#f0f0f0",border:"none",color:form.gst?.length===15?"white":"#aaa",fontSize:12,fontWeight:700,cursor:form.gst?.length===15?"pointer":"default",whiteSpace:"nowrap",flexShrink:0}}>
                  {gstStatus === "checking" ? "Checking..." : "Verify GST"}
                </button>
              </div>
              {gstStatus === "verified" && gstData && (
                <div style={{marginTop:8,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:14}}>✅</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>GST Verified — this store will get a verified badge</span>
                  </div>
                  <div style={{fontSize:12,color:"#080808"}}><strong>Legal Name:</strong> {gstData.lgnm}</div>
                  {gstData.sts && <div style={{fontSize:12,color:"#080808"}}><strong>Status:</strong> {gstData.sts}</div>}
                  {gstData.rgdt && <div style={{fontSize:12,color:"#080808"}}><strong>Registered:</strong> {gstData.rgdt}</div>}
                  {gstData.ctb && <div style={{fontSize:12,color:"#080808"}}><strong>Business Type:</strong> {gstData.ctb}</div>}
                  <div style={{fontSize:11,color:"#16a34a",marginTop:4,fontWeight:600}}>+20 points awarded for GST verified store 🎉</div>
                </div>
              )}
              {gstStatus === "invalid" && (
                <div style={{marginTop:6,padding:"8px 12px",background:"#fff0f0",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:"#dc2626"}}>
                  ❌ GST number not found in public registry — please check and try again.
                </div>
              )}
              {gstStatus === "error" && (
                <div style={{marginTop:6,padding:"8px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#d97706"}}>
                  ⚠ Could not connect to GST registry — store will be saved as community added.
                </div>
              )}
            </div>}
            <div className="field">
              <label className="fl">Website</label>
              <input className="fi" placeholder="www.example.com" value={form.website} onChange={e => upd("website", e.target.value)} />
            </div>
            {recType === "individual" && <>
              <div className="field">
                <label className="fl">LinkedIn</label>
                <input className="fi" placeholder="linkedin.com/in/..." value={form.linkedIn} onChange={e => upd("linkedIn", e.target.value)} />
              </div>
              <div className="field">
                <label className="fl">Facebook</label>
                <input className="fi" placeholder="facebook.com/..." value={form.facebook} onChange={e => upd("facebook", e.target.value)} />
              </div>
            </>}
            {recType === "store" && <div className="field" style={{ gridColumn: "1/-1" }}>
              <label className="fl">Brands Carried</label>
              <textarea className="fta" placeholder="e.g. Asian Paints - Distributor, Berger - Retailer, Nerolac" value={form.brands} onChange={e => upd("brands", e.target.value)} />
            </div>}
          </div>
        </div>

        <div className="sec">
          <div className="sec-hd">Data Checklist <span style={{ color: "var(--t3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— check what you've verified</span></div>
          <div className="checklist">
            {CL.map(item => (
              <div key={item} className={`chk ${checklist.includes(item) ? "on" : ""}`} onClick={() => toggleChk(item)}>
                <div className="chk-box">{checklist.includes(item) && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}</div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", padding: "14px", fontSize: "15px", borderRadius: "var(--r)", marginTop: 8 }} onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Submitting..." : `Submit ${recType === "store" ? "Store" : "Profile"}  +10 pts →`}
        </button>
      </div>
    </div>
  );
}
