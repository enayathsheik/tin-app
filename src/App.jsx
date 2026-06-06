import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// FIREBASE INTEGRATION POINTS
// Replace these stubs with real Firebase calls
// import { initializeApp } from 'firebase/app';
// import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, increment } from 'firebase/firestore';
// import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
// ============================================================
// ============================================================
// FIREBASE — LIVE CONFIG
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, increment, query, where, orderBy, serverTimestamp, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAL2plvt3XiwLjsHRXxiqsDJnUQIOvNF3I",
  authDomain: "trade-intelligence-netwo-97997.firebaseapp.com",
  projectId: "trade-intelligence-netwo-97997",
  storageBucket: "trade-intelligence-netwo-97997.firebasestorage.app",
  messagingSenderId: "587892307032",
  appId: "1:587892307032:web:9926c4fa1d3267abefc62d",
  measurementId: "G-2DTB0TYBL7"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Helper: save user profile to Firestore
async function saveUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// Helper: get user profile
async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ============================================================
// CATEGORY TREE — 3 levels
// ============================================================
const CATEGORY_TREE = {
  "Paints": {
    "Interior Paints": ["Emulsion","Distemper","Primer","Enamel","Texture"],
    "Exterior Paints": ["Weather Coat","Texture Paint","Masonry Paint","Elastomeric"],
    "Wood Finishes": ["Melamine","PU Coat","NC Lacquer","Varnish"],
    "Waterproofing": ["Bituminous","Crystalline","Cementitious","Polyurethane"],
  },
  "Ceramic Tiles": {
    "Floor Tiles": ["Anti-Skid","Matt","Glossy","Parking","Industrial"],
    "Wall Tiles": ["Glossy","Matt","Subway","Mosaic"],
    "Vitrified Tiles": ["GVT","PGVT","Double Charge","Full Body"],
    "Outdoor Tiles": ["Parking","Paving","Pool Coping"],
  },
  "Marble & Stone": {
    "Marble": ["Italian","Indian","Imported","Onyx"],
    "Granite": ["Indian","Imported","Black","Multi-colour"],
    "Sandstone": ["Jodhpur","Agra","Dholpur"],
    "Slate & Quartzite": ["Slate","Quartzite","Limestone"],
  },
  "Plywood": {
    "Commercial Ply": ["BWR","MR","Flexi Ply","Shuttering Ply"],
    "Marine Ply": ["IS 710","Fire Retardant","Boiling Water Resistant"],
    "Block Board": ["Solid Core","Hollow Core","Flush Door"],
    "MDF & Particle Board": ["MDF","HDF","Particle Board","Pre-lam"],
  },
  "Laminates": {
    "Decorative Laminates": ["High Pressure","Low Pressure","Compact"],
    "Wood Finish": ["Teak","Walnut","Oak","Wenge"],
    "Solid Colors": ["Gloss","Matt","Suede","Metallic"],
    "Special Finish": ["Anti-fingerprint","Anti-bacterial","Chalk Paint"],
  },
  "Hardware": {
    "Architectural Hardware": ["Hinges","Handles","Locks","Stoppers"],
    "Furniture Hardware": ["Cabinet Hinges","Drawer Systems","Handles","Connectors"],
    "Construction Hardware": ["Anchors","Fasteners","Wire Mesh","MS Sections"],
    "Tools": ["Power Tools","Hand Tools","Measuring","Safety"],
  },
  "Electrical": {
    "Wiring Accessories": ["Switches","Sockets","MCB","Distribution Boards"],
    "Cables & Wires": ["House Wire","Armoured","Co-axial","Data Cables"],
    "Conduits & Accessories": ["PVC Conduit","GI Conduit","Trunking","Junction Boxes"],
    "Power Products": ["UPS","Stabilizers","Inverters","Solar"],
  },
  "Lighting": {
    "Indoor Lighting": ["LED Panels","Downlights","Track Lights","Strip Lights"],
    "Outdoor Lighting": ["Streetlights","Floodlights","Garden Lights","Bollards"],
    "Decorative Lighting": ["Chandeliers","Pendants","Wall Sconces","Table Lamps"],
    "Industrial Lighting": ["High Bay","Flood","Explosion Proof","Emergency"],
  },
  "Plumbing": {
    "Pipes & Fittings": ["CPVC","UPVC","GI","PPR","HDPE"],
    "Sanitary Ware": ["WC","Wash Basin","Urinal","Bath Tub"],
    "Faucets & Mixers": ["Basin Mixer","Shower","Kitchen","Concealed"],
    "Water Tanks": ["HDPE","FRP","RCC","SS"],
  },
  "Furniture": {
    "Residential Furniture": ["Bedroom","Living Room","Dining","Kitchen"],
    "Office Furniture": ["Workstations","Chairs","Conference","Storage"],
    "Outdoor Furniture": ["Garden","Pool Side","Balcony","Commercial"],
    "Modular Furniture": ["Modular Kitchen","Wardrobe","Storage","TV Units"],
  },
  "Interior Solutions": {
    "False Ceiling": ["Gypsum","Grid","POP","Wood","Metal"],
    "Flooring": ["Wooden","Vinyl","Epoxy","Carpet Tiles","Cork"],
    "Partitions": ["Glass","Gypsum","Aluminium","Movable"],
    "Wall Treatments": ["Wallpaper","Fabric","Acoustic Panels","Cladding"],
  },
  "Construction Chemicals": {
    "Admixtures": ["Plasticizer","Superplasticizer","Retarder","Accelerator"],
    "Repair & Rehabilitation": ["Epoxy Mortar","Crack Filler","Gunite","Shotcrete"],
    "Adhesives & Sealants": ["Tile Adhesive","Epoxy","Silicone","PU Sealant"],
    "Surface Treatment": ["Curing Compound","Hardener","Release Agent","Form Oil"],
  },
  "Aluminium Systems": {
    "Windows & Doors": ["Sliding","Casement","Tilt & Turn","Bi-fold"],
    "Curtain Wall": ["Stick System","Unitised","Semi-unitised","Structural Glazing"],
    "Partitions": ["Glass Partition","Aluminium Partition","Frameless","Framed"],
    "Profiles & Accessories": ["Extrusions","Hardware","Sealants","Glass Beads"],
  },
  "Glass & Facade": {
    "Flat Glass": ["Float","Toughened","Laminated","Insulated"],
    "Processed Glass": ["Frosted","Digital Print","Bent","Mirror"],
    "Facade Systems": ["ACP","HPL","Stone Cladding","GRC"],
    "Specialty Glass": ["Solar Control","Self Cleaning","Smart Glass","Acoustic"],
  },
  "Roofing": {
    "Metal Roofing": ["Corrugated GI","Standing Seam","Sandwich Panel","Colorcoat"],
    "Tiles Roofing": ["Mangalore Tiles","Concrete Tiles","Clay Tiles","Slate"],
    "Waterproofing": ["Torch Applied","Self Adhesive","Liquid Applied","APP/SBS"],
    "Accessories": ["Ridge Caps","Flashings","Skylights","Gutters"],
  },
  "Home Improvement": {
    "Bath Accessories": ["Towel Bars","Soap Dish","Shower Curtain","Mirrors"],
    "Kitchen Accessories": ["Sinks","Baskets","Hinges","Channels"],
    "Curtains & Blinds": ["Roller Blinds","Venetian","Curtain Rods","Roman Blinds"],
    "Storage Solutions": ["Wardrobe Systems","Shelving","Pegboards","Hooks"],
  },
};

const BUSINESS_TYPES = ["Retailer","Distributor","Wholesaler","Manufacturer","Contractor","Architect","Designer","Consultant"];
const CITIES = ["Mumbai","Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad","Surat","Jaipur","Lucknow","Kanpur","Nagpur","Indore","Thane","Bhopal","Visakhapatnam","Pimpri-Chinchwad","Patna","Vadodara","Ghaziabad","Ludhiana","Agra","Nashik","Faridabad","Meerut","Rajkot","Kalyan-Dombivli","Vasai-Virar","Varanasi","Srinagar","Aurangabad","Dhanbad","Amritsar","Navi Mumbai","Allahabad","Ranchi","Howrah","Coimbatore","Jabalpur","Gwalior","Vijayawada","Jodhpur","Madurai","Raipur","Kota","Guwahati","Chandigarh","Solapur","Hubli-Dharwad"];
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

const ROLES = [
  { id: "consumer", label: "Consumer", icon: "👤", desc: "Browse and discover" },
  { id: "contributor", label: "Contributor", icon: "✍️", desc: "Add and verify stores" },
  { id: "retailer", label: "Retailer / Distributor", icon: "🏪", desc: "List your business" },
  { id: "contractor", label: "Contractor", icon: "🔧", desc: "Find suppliers" },
  { id: "architect", label: "Architect / Designer", icon: "📐", desc: "Source materials" },
  { id: "manufacturer", label: "Manufacturer", icon: "🏭", desc: "Map your dealers" },
  { id: "admin", label: "Admin", icon: "⚙️", desc: "Manage platform" },
];

const CONTRIBUTOR_LEVELS = [
  { name: "Bronze", min: 0, max: 99, color: "#cd7f32", bg: "#cd7f3215" },
  { name: "Silver", min: 100, max: 499, color: "#a8a8b8", bg: "#a8a8b815" },
  { name: "Gold", min: 500, max: 1999, color: "#ffd700", bg: "#ffd70015" },
  { name: "Platinum", min: 2000, max: 9999, color: "#e0e8f0", bg: "#e0e8f015" },
  { name: "Legend", min: 10000, max: Infinity, color: "#ff6b35", bg: "#ff6b3515" },
];

function getLevel(pts) { return CONTRIBUTOR_LEVELS.find(l => pts >= l.min && pts <= l.max) || CONTRIBUTOR_LEVELS[0]; }

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_STORES = [
  { id:"s1", type:"store", storeName:"Sharma Hardware & Tools", phone:"9820012345", address:"Shop 5, Link Road", city:"Mumbai", state:"Maharashtra", pincode:"400053", categories:[{category:"Hardware",subCategory:"Architectural Hardware",productType:"Handles"},{category:"Paints",subCategory:"Interior Paints",productType:"Emulsion"}], businessType:"Retailer", ownerName:"Rajesh Sharma", email:"sharma@gmail.com", gst:"27AABCS1429B1ZB", brands:"Dorma, Hettich, Hafele", verificationStatus:"verified", lat:19.1334, lng:72.8269, contributorId:"u1", pointsAwarded:10, createdAt:"2024-01-15", confidence:92 },
  { id:"s2", type:"store", storeName:"Delhi Tiles & Marble Centre", phone:"9811234567", address:"Plot 12, Okhla Phase 2", city:"Delhi", state:"Delhi", pincode:"110020", category:"Ceramic Tiles", subCategory:"Vitrified Tiles", productType:"GVT", businessType:"Distributor", ownerName:"Suresh Kumar", email:"", gst:"", whatsapp:"9811234567", instagram:"", brands:"Kajaria, Somany, Johnson", verificationStatus:"community_added", lat:28.5355, lng:77.2910, contributorId:"u2", pointsAwarded:10, createdAt:"2024-01-20", confidence:45 },
  { id:"s3", type:"store", storeName:"Raj Plywood & Laminates", phone:"9899876543", address:"Timber Market, Kirti Nagar", city:"Delhi", state:"Delhi", pincode:"110015", category:"Plywood", subCategory:"Commercial Ply", productType:"BWR", businessType:"Wholesaler", ownerName:"", email:"", gst:"", whatsapp:"", instagram:"@rajplydelhi", brands:"Greenply, Century, Kitply", verificationStatus:"community_added", lat:28.6509, lng:77.1445, contributorId:"u1", pointsAwarded:10, createdAt:"2024-02-01", confidence:38 },
  { id:"s4", type:"store", storeName:"Asian Paints Color World", phone:"9867543210", address:"MG Road, Pune", city:"Pune", state:"Maharashtra", pincode:"411001", category:"Paints", subCategory:"Interior Paints", productType:"Emulsion", businessType:"Retailer", ownerName:"Priya Patel", email:"priya@colorworld.in", gst:"27BBPCS9876A1ZC", brands:"Asian Paints, Berger, Nerolac", verificationStatus:"verified", lat:18.5204, lng:73.8567, contributorId:"u3", pointsAwarded:10, createdAt:"2024-02-10", confidence:88 },
  { id:"s5", type:"individual", storeName:"Amit Contractors", phone:"9988776655", address:"Sector 14, Gurgaon", city:"Delhi", state:"Haryana", pincode:"122001", category:"Interior Solutions", subCategory:"False Ceiling", productType:"Gypsum", businessType:"Contractor", ownerName:"Amit Verma", email:"amit.v@gmail.com", gst:"", brands:"", verificationStatus:"community_added", lat:28.4595, lng:77.0266, contributorId:"u2", pointsAwarded:10, createdAt:"2024-02-15", confidence:55 },
];

const MOCK_CONTRIBUTORS = [
  { id:"u1", name:"Ravi Kumar", email:"ravi@aaronbuilders.com", workEmail:"ravi@aaronbuilders.com", personalEmail:"ravi.kumar@gmail.com", role:"contributor", points:1240, storesAdded:47, citiesCovered:8, city:"Mumbai", company:"Aaron Builders", linkedin:"linkedin.com/in/ravikumar", validationStatus:"active" },
  { id:"u2", name:"Priya Singh", email:"priya@designstudio.in", workEmail:"priya@designstudio.in", personalEmail:"priya.s@gmail.com", role:"contributor", points:890, storesAdded:31, citiesCovered:5, city:"Delhi", company:"Design Studio", linkedin:"linkedin.com/in/priyasingh", validationStatus:"active" },
  { id:"u3", name:"Amit Patel", email:"amit@infratech.co.in", workEmail:"amit@infratech.co.in", personalEmail:"amit.p@gmail.com", role:"contributor", points:650, storesAdded:22, citiesCovered:4, city:"Pune", company:"InfraTech", linkedin:"", validationStatus:"pending" },
  { id:"u4", name:"Sunita Rao", email:"sunita@buildcorp.in", workEmail:"sunita@buildcorp.in", personalEmail:"sunita.r@gmail.com", role:"contributor", points:420, storesAdded:18, citiesCovered:3, city:"Bengaluru", company:"BuildCorp", linkedin:"linkedin.com/in/sunitarao", validationStatus:"pending" },
  { id:"u5", name:"Vikram Joshi", email:"vikram@renovate.in", workEmail:"vikram@renovate.in", personalEmail:"vikram.j@gmail.com", role:"contributor", points:180, storesAdded:9, citiesCovered:2, city:"Hyderabad", company:"Renovate India", linkedin:"linkedin.com/in/vikramjoshi", validationStatus:"active" },
];


// ============================================================
// REWARD SCHEME
// ============================================================
const CASH_REWARDS = [
  { points: 1000, amount: 500, label: "₹500 Cash Reward" },
  { points: 5000, amount: 3000, label: "₹3,000 Cash Reward" },
  { points: 10000, amount: 10000, label: "₹10,000 Cash Reward" },
];

const BULK_REWARDS = [
  { type: "Retail Store Data", count: 500, amount: 3000, points: 500 },
  { type: "Contractor Data", count: 1000, amount: 3000, points: 1000 },
  { type: "Architect / Designer Data", count: 1000, amount: 3000, points: 1000 },
];

const MOCK_CONTRACTORS = [
  { id:"c1", name:"Suresh Sharma", phone:"9820011111", city:"Mumbai", category:"Civil Contractor", company:"Sharma Constructions", experience:"12 yrs", email:"suresh@sharmaconstruct.com", linkedin:"linkedin.com/in/sureshsharma", specialization:"Residential & Commercial" },
  { id:"c2", name:"Ramesh Patel", phone:"9811022222", city:"Delhi", category:"Interior Contractor", company:"Patel Interiors", experience:"8 yrs", email:"ramesh@patelinteriors.in", linkedin:"", specialization:"False Ceiling & Flooring" },
  { id:"c3", name:"Vijay Kumar", phone:"9867033333", city:"Mumbai", category:"MEP Contractor", company:"VK Services", experience:"15 yrs", email:"vijay@vkservices.com", linkedin:"linkedin.com/in/vijaykumar", specialization:"Plumbing & Electrical" },
  { id:"c4", name:"Anil Verma", phone:"9988044444", city:"Pune", category:"Painting Contractor", company:"Verma Paints", experience:"6 yrs", email:"", linkedin:"", specialization:"Interior & Exterior Painting" },
  { id:"c5", name:"Deepak Singh", phone:"9876055555", city:"Delhi", category:"Civil Contractor", company:"Singh Builders", experience:"20 yrs", email:"deepak@singhbuilders.in", linkedin:"linkedin.com/in/deepaksingh", specialization:"High-rise Construction" },
];

const MOCK_ARCHITECTS = [
  { id:"a1", name:"Priya Mehta", phone:"9820099001", city:"Mumbai", category:"Architect", firm:"Mehta Associates", experience:"14 yrs", email:"priya@mehtaarch.com", linkedin:"linkedin.com/in/priyamehta", specialization:"Residential & Hospitality" },
  { id:"a2", name:"Rahul Sharma", phone:"9811099002", city:"Delhi", category:"Interior Designer", firm:"Sharma Design Studio", experience:"9 yrs", email:"rahul@sharmadesign.in", linkedin:"linkedin.com/in/rahulsharma", specialization:"Commercial Interiors" },
  { id:"a3", name:"Neha Joshi", phone:"9867099003", city:"Mumbai", category:"Architect", firm:"Joshi & Partners", experience:"11 yrs", email:"neha@joshiarch.com", linkedin:"linkedin.com/in/nehajoshi", specialization:"Healthcare & Institutional" },
  { id:"a4", name:"Sanjay Gupta", phone:"9988099004", city:"Bengaluru", category:"Interior Designer", firm:"Gupta Interiors", experience:"7 yrs", email:"", linkedin:"", specialization:"Luxury Residential" },
  { id:"a5", name:"Anita Rao", phone:"9876099005", city:"Delhi", category:"Architect", firm:"Rao Architecture", experience:"18 yrs", email:"anita@raoarch.in", linkedin:"linkedin.com/in/anitarao", specialization:"Urban Planning & Commercial" },
];

const MOCK_LEADS = [
  { id:"l1", type:"Project Lead", title:"3BHK Renovation - Bandra West", budget:"₹18-22 Lakhs", city:"Mumbai", category:"Interior Solutions", postedBy:"Homeowner", contact:"Available to Legend", date:"2024-03-01" },
  { id:"l2", type:"Market Lead", title:"New Housing Project - 200 Units", budget:"₹2-3 Crore materials", city:"Pune", category:"Multiple", postedBy:"Developer", contact:"Available to Legend", date:"2024-03-05" },
  { id:"l3", type:"Project Lead", title:"Office Fitout - 8000 sqft", budget:"₹45 Lakhs", city:"Delhi", category:"Furniture & Flooring", postedBy:"Corporate", contact:"Available to Legend", date:"2024-03-08" },
];

const DUPLICATE_PAIRS = [
  { id:"d1", store1: MOCK_STORES[1], store2: {...MOCK_STORES[1], id:"s2b", storeName:"Delhi Tiles Centre", phone:"9811234567", confidence:72}, matchReason:"Same phone number" },
  { id:"d2", store1: MOCK_STORES[2], store2: {...MOCK_STORES[2], id:"s3b", storeName:"Raj Ply House", address:"Kirti Nagar Timber", confidence:41}, matchReason:"Same city + category + similar name" },
];

// ============================================================
// STYLES
// ============================================================
const G = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08090d;--s1:#0f1018;--s2:#161720;--s3:#1e1f2e;
  --b1:#ffffff08;--b2:#ffffff12;--b3:#ffffff1e;
  --t1:#080808;--t2:#080808;--t3:#080808;
  --acc:#e85a2a;--acc2:#f07d50;--acc3:#ff9a6c;
  --ok:#22c55e;--warn:#f59e0b;--info:#3b82f6;
  --r:10px;--rl:16px;--rxl:24px;
}
html,body{height:100%;background:var(--bg);color:var(--t1);font-family:'Barlow',sans-serif;font-size:14px;line-height:1.5}
#root{height:100%;display:flex;flex-direction:column}

/* LAYOUT */
.app{display:flex;flex-direction:column;height:100vh;overflow:hidden}
.topbar{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--bg);border-bottom:1px solid var(--b1);flex-shrink:0;z-index:200}
.logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.06em;color:var(--t1)}
.logo em{color:var(--acc);font-style:normal}
.nav-tabs{display:flex;gap:1px;background:var(--s2);border-radius:var(--r);padding:3px}
.ntab{padding:5px 14px;border-radius:7px;font-size:13px;font-weight:500;color:#080808;cursor:pointer;transition:all .15s;border:none;background:transparent;font-family:'Barlow',sans-serif}
.ntab:hover{color:#080808}
.ntab.on{background:var(--s3);color:var(--t1)}
.topbar-right{display:flex;align-items:center;gap:10px}
.pts-badge{font-size:12px;font-weight:700;color:var(--acc);background:var(--acc)18;padding:3px 10px;border-radius:20px;border:1px solid var(--acc)28}
.avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc3));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;cursor:pointer;color:white;font-family:'Barlow Condensed',sans-serif;flex-shrink:0}
.page{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* CITY HERO */
.hero{height:100%;overflow-y:auto;background:var(--bg)}
.hero-top{padding:60px 24px 40px;max-width:880px;margin:0 auto;text-align:center}
.hero-eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-bottom:16px}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:clamp(36px,6vw,64px);line-height:1;color:var(--t1);margin-bottom:16px}
.hero-title span{color:var(--acc)}
.hero-sub{font-size:16px;color:#080808;max-width:520px;margin:0 auto 40px;line-height:1.6}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:680px;margin:0 auto 48px}
.stat-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:16px;text-align:center}
.stat-num{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;color:var(--acc)}
.stat-lbl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.city-section{padding:0 24px 48px;max-width:880px;margin:0 auto;width:100%}
.section-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#080808;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.section-hd::after{content:'';flex:1;height:1px;background:var(--b2)}
.city-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.city-pill{padding:10px 16px;border-radius:var(--r);background:var(--s1);border:1px solid var(--b2);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:space-between;gap:8px}
.city-pill:hover,.city-pill.sel{background:var(--s2);border-color:var(--b3);color:var(--t1)}
.city-pill.sel{border-color:var(--acc);background:var(--acc)12}
.city-name{font-weight:600;font-size:13px}
.city-count{font-size:11px;color:#080808}
.hero-cta{display:flex;gap:10px;justify-content:center;margin-top:32px;flex-wrap:wrap}
.btn{padding:10px 20px;border-radius:var(--r);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;border:none;font-family:'Barlow',sans-serif;letter-spacing:.02em}
.btn-primary{background:var(--acc);color:white}
.btn-primary:hover{background:var(--acc2);transform:translateY(-1px)}
.btn-ghost{background:transparent;color:#080808;border:1px solid var(--b3)}
.btn-ghost:hover{color:var(--t1);border-color:var(--b3);background:var(--s2)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}

/* DISCOVERY */
.discovery{display:flex;height:100%}
.disc-sidebar{width:340px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden}
.disc-main{flex:1;overflow-y:auto}
.disc-sidebar-hd{padding:14px 16px;border-bottom:1px solid var(--b1)}
.srch{display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:8px 12px;margin-bottom:10px}
.srch input{flex:1;background:none;border:none;outline:none;color:var(--t1);font-size:13px;font-family:'Barlow',sans-serif}
.srch input::placeholder{color:#080808}
.chips{display:flex;gap:5px;flex-wrap:wrap}
.chip{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--s2);border:1px solid var(--b2);color:#080808;cursor:pointer;transition:all .15s;white-space:nowrap}
.chip:hover,.chip.on{background:var(--acc)18;border-color:var(--acc)40;color:var(--acc)}
.store-list{flex:1;overflow-y:auto;padding:8px}
.sc{padding:12px;border-radius:var(--r);margin-bottom:6px;background:var(--s2);border:1px solid var(--b1);cursor:pointer;transition:all .15s}
.sc:hover{border-color:var(--b3)}
.sc.sel{border-color:var(--acc)}
.sc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px}
.sc-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;line-height:1.2}
.badge{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;white-space:nowrap;flex-shrink:0}
.bv{background:#22c55e15;color:var(--ok);border:1px solid #22c55e25}
.bc{background:#f59e0b15;color:var(--warn);border:1px solid #f59e0b25}
.bp{background:#3b82f615;color:var(--info);border:1px solid #3b82f625}
.sc-meta{font-size:11px;color:#080808;display:flex;gap:8px;flex-wrap:wrap}
.conf-bar{height:3px;border-radius:2px;background:var(--b2);margin-top:8px;overflow:hidden}
.conf-fill{height:100%;border-radius:2px;transition:width .6s}

/* STORE DETAIL */
.detail-panel{padding:24px;max-width:640px}
.detail-hd{margin-bottom:20px}
.detail-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;margin-bottom:8px}
.detail-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.dg-item{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:12px}
.dg-label{font-size:11px;color:#080808;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
.dg-value{font-size:13px;font-weight:500}
.cat-breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:#080808;margin-bottom:16px;flex-wrap:wrap}
.cat-sep{color:var(--b3)}
.cat-node{color:#080808}
.cat-node.last{color:var(--acc);font-weight:600}
.conf-section{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px;margin-bottom:16px}
.conf-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.conf-title{font-size:12px;font-weight:600;color:#080808}
.conf-pct{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px}
.conf-bar2{height:6px;border-radius:3px;background:var(--b2);overflow:hidden}
.conf-fill2{height:100%;border-radius:3px}
.enrich-row{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.enrich-pill{padding:4px 10px;border-radius:20px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
.enrich-pill.linked{color:var(--ok);border-color:#22c55e25;background:#22c55e08}
.action-row{display:flex;gap:8px;flex-wrap:wrap}
.btn-sm{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;border:none;font-family:'Barlow',sans-serif}
.btn-acc{background:var(--acc);color:white}
.btn-acc:hover{background:var(--acc2)}
.btn-out{background:transparent;color:#080808;border:1px solid var(--b3)}
.btn-out:hover{color:var(--t1);background:var(--s3)}
.btn-ok{background:#22c55e15;color:var(--ok);border:1px solid #22c55e25}
.empty-detail{display:flex;align-items:center;justify-content:center;height:100%;color:#080808;font-size:14px;flex-direction:column;gap:12px;text-align:center;padding:40px}

/* ADD FORM */
.form-pg{height:100%;overflow-y:auto}
.form-wrap{max-width:680px;margin:0 auto;padding:24px 20px 60px}
.form-hd{margin-bottom:24px}
.form-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.form-sub{color:#080808;font-size:13px}
.pts-hint{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--acc)10;border:1px solid var(--acc)20;border-radius:var(--r);margin-bottom:20px;font-size:13px;color:var(--acc);font-weight:600}
.sec{margin-bottom:24px}
.sec-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#080808;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.sec-hd::after{content:'';flex:1;height:1px;background:var(--b1)}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fg1{grid-template-columns:1fr}
.fg3{grid-template-columns:1fr 1fr 1fr}
.field{display:flex;flex-direction:column;gap:5px}
.fl{font-size:11px;color:#080808;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.fl .req{color:var(--acc)}
.fi,.fs,.fta{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:9px 13px;color:var(--t1);font-size:13px;font-family:'Barlow',sans-serif;outline:none;transition:border-color .15s;width:100%}
.fi:focus,.fs:focus,.fta:focus{border-color:var(--acc)}
.fi::placeholder,.fta::placeholder{color:#080808}
.fs{appearance:none;cursor:pointer}
.fs option{background:var(--s2)}
.fta{resize:vertical;min-height:72px}
.cat-selector{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);overflow:hidden}
.cat-row{display:flex;border-bottom:1px solid var(--b1)}
.cat-col{flex:1;overflow-y:auto;max-height:160px;border-right:1px solid var(--b1)}
.cat-col:last-child{border-right:none}
.cat-col-hd{padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#080808;background:var(--s3);border-bottom:1px solid var(--b1)}
.cat-item{padding:7px 10px;font-size:12px;color:#080808;cursor:pointer;transition:all .1s;border-bottom:1px solid var(--b1)}
.cat-item:hover{background:var(--s3);color:var(--t1)}
.cat-item.on{background:var(--acc)15;color:var(--acc);font-weight:600}
.cat-selected{padding:8px 12px;font-size:12px;color:#080808;background:var(--s1)}
.loc-field{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.loc-info{flex:1}
.loc-txt{font-size:12px;color:#080808}
.loc-coords{font-size:11px;color:var(--acc);font-family:monospace;margin-top:2px}
.checklist{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.chk{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--s2);border:1px solid var(--b1);border-radius:8px;cursor:pointer;transition:all .15s;font-size:12px;color:#080808}
.chk:hover{border-color:var(--b2);color:var(--t1)}
.chk.on{background:var(--acc)12;border-color:var(--acc)30;color:var(--t1)}
.chk-box{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--b3);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.chk.on .chk-box{background:var(--acc);border-color:var(--acc)}
.type-tabs{display:flex;gap:8px;margin-bottom:20px}
.type-tab{flex:1;padding:12px;border-radius:var(--r);background:var(--s2);border:2px solid var(--b2);cursor:pointer;text-align:center;transition:all .15s}
.type-tab:hover{border-color:var(--b3)}
.type-tab.on{border-color:var(--acc);background:var(--acc)10}
.type-tab-icon{font-size:20px;margin-bottom:4px}
.type-tab-label{font-size:12px;font-weight:700}
.type-tab-desc{font-size:11px;color:#080808;margin-top:2px}

/* LEADERBOARD */
.lb-pg{height:100%;overflow-y:auto}
.lb-wrap{max-width:680px;margin:0 auto;padding:24px 20px}
.lb-hd{margin-bottom:20px}
.lb-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.lb-sub{color:#080808;font-size:13px}
.lb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.lb-stat{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:14px;text-align:center}
.lb-sv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;color:var(--acc)}
.lb-sl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.lb-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--r);background:var(--s1);border:1px solid var(--b1);margin-bottom:6px;transition:border-color .15s}
.lb-row:hover{border-color:var(--b2)}
.lb-rank{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;width:36px;color:#080808;text-align:center}
.lb-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;color:white;flex-shrink:0}
.lb-info{flex:1}
.lb-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px}
.lb-meta{font-size:11px;color:#080808;margin-top:1px}
.lb-pts{text-align:right}
.lb-pv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:17px;color:var(--acc)}
.lb-lv{font-size:10px;font-weight:700;margin-top:1px}

/* PROFILE */
.prof-pg{height:100%;overflow-y:auto}
.prof-wrap{max-width:680px;margin:0 auto;padding:24px 20px}
.prof-hero{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:24px;margin-bottom:14px;position:relative;overflow:hidden}
.prof-hero::after{content:'TIN';position:absolute;right:-10px;top:-16px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:120px;color:var(--acc);opacity:.04;pointer-events:none;line-height:1}
.prof-top{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.prof-av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc3));display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:white;flex-shrink:0}
.prof-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px}
.prof-role{font-size:12px;color:#080808;margin-top:2px}
.prof-lbadge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:5px}
.prof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.prof-stat{text-align:center;padding:10px;background:var(--s2);border-radius:var(--r)}
.prof-sv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px}
.prof-sl{font-size:11px;color:#080808;margin-top:1px}
.prog-sec{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px;margin-bottom:14px}
.prog-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:14px}
.lv-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.lv-name{font-size:12px;font-weight:700;width:56px}
.lv-bar{flex:1;height:5px;background:var(--s3);border-radius:3px;overflow:hidden}
.lv-fill{height:100%;border-radius:3px;transition:width .8s ease}
.lv-pts{font-size:11px;color:#080808;width:56px;text-align:right}
.act-sec{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px}
.act-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:14px}
.act-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b1)}
.act-item:last-child{border-bottom:none}
.act-dot{width:7px;height:7px;border-radius:50%;background:var(--acc);flex-shrink:0}
.act-text{flex:1;font-size:13px}
.act-meta{font-size:11px;color:#080808;margin-top:1px}
.act-pts{font-size:12px;color:var(--acc);font-weight:700}

/* ADMIN */
.admin-pg{display:flex;height:100%}
.admin-nav{width:200px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);padding:16px 12px;display:flex;flex-direction:column;gap:2px}
.admin-nav-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#080808;padding:4px 10px;margin-bottom:6px}
.anav{padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;color:#080808;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px}
.anav:hover{color:#080808;background:var(--s2)}
.anav.on{background:var(--s3);color:var(--t1)}
.anav-icon{font-size:15px}
.admin-main{flex:1;overflow-y:auto;padding:24px}
.admin-hd{margin-bottom:24px}
.admin-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;margin-bottom:4px}
.admin-sub{color:#080808;font-size:13px}
.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.as-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px}
.as-val{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;color:var(--acc)}
.as-lbl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.as-delta{font-size:11px;color:var(--ok);margin-top:4px;font-weight:600}
.table-wrap{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);overflow:hidden}
.table-hd{padding:14px 16px;border-bottom:1px solid var(--b1);display:flex;justify-content:space-between;align-items:center}
.table-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px}
table{width:100%;border-collapse:collapse}
th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#080808;border-bottom:1px solid var(--b1)}
td{padding:10px 14px;font-size:13px;border-bottom:1px solid var(--b1);color:#080808}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--s2);color:var(--t1)}

/* BULK UPLOAD */
.upload-zone{border:2px dashed var(--b3);border-radius:var(--rl);padding:40px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:20px}
.upload-zone:hover,.upload-zone.drag{border-color:var(--acc);background:var(--acc)06}
.upload-icon{font-size:36px;margin-bottom:12px}
.upload-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;margin-bottom:6px}
.upload-sub{font-size:13px;color:#080808}
.tmpl-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.tmpl-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px;cursor:pointer;transition:all .15s}
.tmpl-card:hover{border-color:var(--b3);background:var(--s3)}
.tmpl-icon{font-size:24px;margin-bottom:8px}
.tmpl-name{font-weight:700;font-size:14px;margin-bottom:4px}
.tmpl-desc{font-size:12px;color:#080808}
.tmpl-fields{font-size:11px;color:#080808;margin-top:8px;line-height:1.6}
.preview-table{overflow-x:auto;margin-top:16px}
.preview-table table{min-width:600px}

/* DUPLICATE MANAGER */
.dup-pair{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:16px;margin-bottom:16px}
.dup-reason{font-size:11px;color:var(--warn);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.dup-grid{display:grid;grid-template-columns:1fr 40px 1fr;gap:12px;align-items:start;margin-bottom:14px}
.dup-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:12px}
.dup-card-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:8px}
.dup-field{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.dup-field-lbl{font-size:10px;color:#080808;text-transform:uppercase;letter-spacing:.06em}
.dup-field-val{font-size:12px;color:var(--t1)}
.dup-field-val.diff{color:var(--warn);font-weight:600}
.vs-badge{display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;color:#080808;padding-top:20px}
.dup-actions{display:flex;gap:8px;flex-wrap:wrap}

/* TOAST */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--s3);border:1px solid var(--b3);border-radius:var(--r);padding:11px 20px;font-size:13px;font-weight:600;z-index:1000;transition:transform .25s ease;white-space:nowrap;box-shadow:0 8px 32px #00000060}
.toast.show{transform:translateX(-50%) translateY(0)}
.toast.ok{border-color:#22c55e30;color:var(--ok)}
.toast.err{border-color:#ef444430;color:#ef4444}

/* LOGIN */
.login-pg{height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)}
.login-card{width:420px;background:var(--s1);border:1px solid var(--b2);border-radius:var(--rxl);padding:36px}
.login-logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;letter-spacing:.14em;color:#080808;margin-bottom:6px;text-transform:uppercase}
.login-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;margin-bottom:6px;color:#080808}
.login-title em{color:#e85a2a;font-style:normal}
.login-sub{color:#080808;font-size:13px;margin-bottom:24px;line-height:1.5}
.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:20px}
.role-opt{padding:10px 12px;border-radius:var(--r);background:var(--s2);border:1.5px solid var(--b2);cursor:pointer;transition:all .15s}
.role-opt:hover{border-color:var(--b3)}
.role-opt.on{border-color:var(--acc);background:var(--acc)10}
.role-icon{font-size:16px;margin-bottom:3px}
.role-lbl{font-size:12px;font-weight:700}
.role-desc{font-size:10px;color:#080808;margin-top:1px}
.login-fields{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
.lf{display:flex;flex-direction:column;gap:5px}
.lf label{font-size:11px;color:#080808;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.btn-login{width:100%;padding:13px;border-radius:var(--r);background:var(--acc);color:white;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;letter-spacing:.04em;transition:all .2s}
.btn-login:hover{background:var(--acc2);transform:translateY(-1px)}
.login-sw{font-size:13px;color:#080808;margin-top:14px;text-align:center}
.login-sw span{color:var(--acc);cursor:pointer;font-weight:700}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--b3);border-radius:2px}


/* MULTI-CATEGORY */
.mcat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:7px;margin-bottom:12px}
.mcat-item{padding:10px 12px;border-radius:var(--r);background:var(--s2);border:1.5px solid var(--b2);cursor:pointer;transition:all .15s}
.mcat-item:hover{border-color:var(--b3)}.mcat-item.on{border-color:var(--acc);background:var(--acc)12}
.mcat-label{font-size:12px;font-weight:700;margin-bottom:2px}
.mcat-count{font-size:10px;color:#080808}
.mcat-expanded{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:12px;margin-bottom:10px}
.mcat-exp-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:var(--acc);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.mcat-sub-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.mcat-sub{padding:4px 10px;border-radius:8px;font-size:12px;background:var(--s2);border:1px solid var(--b2);color:#080808;cursor:pointer;transition:all .15s}
.mcat-sub:hover{border-color:var(--b3);color:var(--t1)}.mcat-sub.on{background:var(--acc)15;border-color:var(--acc)40;color:var(--acc);font-weight:600}
.mcat-prod{padding:3px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b1);color:#080808;cursor:pointer;transition:all .15s}
.mcat-prod.on{background:var(--ok)15;border-color:var(--ok)30;color:var(--ok)}
.sel-cat-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;background:var(--acc)15;border:1px solid var(--acc)30;font-size:11px;color:var(--acc);margin:2px}
.sel-cat-x{cursor:pointer;opacity:.6;font-size:13px;line-height:1}.sel-cat-x:hover{opacity:1}
.cat-tag-group{margin-bottom:8px}
.cat-tag-main{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:var(--acc);margin-bottom:4px}
.cat-tag-subs{display:flex;gap:5px;flex-wrap:wrap}
.cat-sub-tag{padding:2px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
/* STAFF */
.staff-section{margin-top:20px;border-top:1px solid var(--b1);padding-top:18px}
.staff-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.staff-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:13px;margin-bottom:8px;cursor:pointer;transition:all .15s}
.staff-card:hover{border-color:var(--b3)}
.staff-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.staff-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--info),#6366f1);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;color:white;flex-shrink:0}
.staff-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.staff-desig{font-size:12px;color:#080808}
.skill-tag{padding:2px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
.skills-row{display:flex;gap:5px;flex-wrap:wrap}
.wh-timeline{position:relative;padding-left:18px}
.wh-timeline::before{content:'';position:absolute;left:5px;top:0;bottom:0;width:2px;background:var(--b2)}
.wh-entry{position:relative;margin-bottom:14px}
.wh-entry::before{content:'';position:absolute;left:-15px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--s1);border:2px solid var(--acc)}
.wh-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:11px}
.wh-card-role{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.wh-card-store{font-size:12px;color:var(--acc);margin-top:1px}
.wh-card-period{font-size:11px;color:#080808;margin-top:2px}
/* CONTRIB VALIDATION */
.val-warn{background:var(--warn)10;border:1px solid var(--warn)25;border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--warn);margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.val-ok-banner{background:var(--ok)10;border:1px solid var(--ok)25;border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--ok);margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.contrib-note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--r);padding:10px 14px;font-size:12px;color:#1d4ed8;margin-bottom:14px;line-height:1.5}
.val-status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700}
.vs-pending{background:var(--warn)15;color:var(--warn);border:1px solid var(--warn)25}
.vs-active{background:var(--ok)15;color:var(--ok);border:1px solid var(--ok)25}


/* LIGHT MODE — default */
.light{
  --bg:#f4f5f7;--s1:#ffffff;--s2:#f0f1f5;--s3:#e8e9f0;--s4:#dfe0ea;
  --b1:#00000008;--b2:#00000014;--b3:#0000002a;--b4:#00000038;
  --t1:#111120;--t2:#080808;--t3:#080808;
  --acc:#e85a2a;--acc2:#d44e22;--acc3:#f07d50;
  --ok:#16a34a;--warn:#d97706;--info:#2563eb;--danger:#dc2626;
}








/* REWARDS PAGE */
.rewards-pg{height:100%;overflow-y:auto}
.rewards-wrap{max-width:720px;margin:0 auto;padding:24px 20px 60px}
.rewards-hd{margin-bottom:24px}
.rewards-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.rewards-sub{color:#080808;font-size:13px}
.reward-hero{background:linear-gradient(135deg,var(--acc)18,var(--acc)05);border:1px solid var(--acc)25;border-radius:var(--rl);padding:24px;margin-bottom:20px;text-align:center}
.reward-pts-big{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:56px;color:var(--acc);line-height:1}
.reward-pts-label{font-size:13px;color:#080808;margin-top:4px}
.reward-progress-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}
.reward-milestone{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:14px;text-align:center;transition:all .2s}
.reward-milestone.unlocked{border-color:var(--ok);background:var(--ok)08}
.reward-milestone.next{border-color:var(--acc);background:var(--acc)08}
.rm-pts{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px}
.rm-reward{font-size:13px;font-weight:700;margin-top:3px}
.rm-status{font-size:11px;margin-top:4px}
.section-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px;margin-bottom:16px}
.sc-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.sc-sub{font-size:12px;color:#080808;margin-bottom:16px}
.unlock-counter{display:flex;align-items:center;gap:12px;padding:12px;background:var(--s2);border-radius:var(--r);margin-bottom:12px}
.unlock-num{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;color:var(--acc)}
.unlock-label{font-size:12px;color:#080808}
.profile-reveal{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.profile-reveal.locked{opacity:.5;filter:blur(1px);pointer-events:none;user-select:none}
.pr-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;color:white;flex-shrink:0}
.pr-info{flex:1}
.pr-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.pr-meta{font-size:12px;color:#080808;margin-top:2px}
.pr-phone{font-size:13px;font-weight:700;color:var(--acc)}
.locked-overlay{display:flex;align-items:center;gap:8px;padding:12px;background:var(--s3);border-radius:var(--r);margin-bottom:8px;font-size:12px;color:#080808}
.bulk-reward-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brc-info{flex:1}
.brc-title{font-size:13px;font-weight:700}
.brc-detail{font-size:11px;color:#080808;margin-top:3px}
.brc-reward{text-align:right}
.brc-amount{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;color:var(--ok)}
.brc-pts{font-size:11px;color:#080808;margin-top:2px}
.msg-btn{display:flex;align-items:center;gap:8px;padding:13px 20px;border-radius:var(--r);background:var(--info)12;border:1px solid var(--info)25;color:var(--info);cursor:pointer;transition:all .15s;font-size:13px;font-weight:700;width:100%;justify-content:center}
.msg-btn:hover{background:var(--info)20;border-color:var(--info)40}
.referral-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px;margin-bottom:10px}
.ref-code{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--acc);letter-spacing:.1em;background:var(--acc)10;padding:10px 20px;border-radius:var(--r);display:inline-block;margin:10px 0;border:1px dashed var(--acc)40}
.leads-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:10px}
.lc-type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--acc);margin-bottom:5px}
.lc-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:5px}
.lc-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#080808}

/* DEALS PAGE */
.deals-pg{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;text-align:center;padding:40px}
.deals-icon{font-size:64px;opacity:.3}
.deals-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px}
.deals-sub{color:#080808;font-size:14px;max-width:400px;line-height:1.6}
.deals-badge{background:var(--acc)12;border:1px solid var(--acc)25;color:var(--acc);padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700}

.coming-soon-role{position:relative;pointer-events:none}
/* Light mode specific overrides */
.light .store-list .sc{background:#fff;border-color:#e0e0ea}
.light .store-list .sc:hover{background:#f8f8fc;border-color:#c0c0d0}
.light .topbar{background:#fff;border-color:#e0e0ea}
.light .nav-tabs{background:#f0f1f5}
.light .ntab.on{background:#fff;color:#080808}
.light .hero{background:#f4f5f7}
.light .stat-card{background:#fff;border-color:#e0e0ea}
.light .city-pill{background:#fff;border-color:#e0e0ea}
.light .city-pill:hover,.light .city-pill.sel{background:#fff3ef;border-color:var(--acc)}
.light .login-card{background:#fff;border-color:#e0e0ea}
.light .fi,.light .fs,.light .fta{background:#fff;border-color:#d0d0e0;color:#080808}
.light .role-opt{background:#f8f8fc;border-color:#e0e0ea}
.light .role-opt.on{background:#fff3ef;border-color:var(--acc)}
.light .section-card,.light .info-card,.light .prog-sec,.light .act-sec{background:#fff;border-color:#e0e0ea}
.light .profile-reveal{background:#f8f8fc;border-color:#e0e0ea}
.light .disc-sidebar{background:#fff;border-color:#e0e0ea}
.light .sc{background:#f8f8fc;border-color:#e0e0ea}
.light .dg-item{background:#f8f8fc;border-color:#e0e0ea}
.light .conf-section{background:#f8f8fc;border-color:#e0e0ea}
.light .table-wrap{background:#fff;border-color:#e0e0ea}
.light .lb-row{background:#fff;border-color:#e0e0ea}
.light .lb-stat{background:#fff;border-color:#e0e0ea}
.light .admin-nav{background:#fff;border-color:#e0e0ea}
.light .anav.on{background:#f0f1f5}
.light .anav:hover{background:#f8f8fc}
.light .srch{background:#f0f1f5;border-color:#d0d0e0}
.light .srch input{color:#080808}
.light .chip{background:#f0f1f5;border-color:#d0d0e0;color:#080808}
.light .chip.on{background:#fff3ef;border-color:var(--acc)40;color:var(--acc)}
.light .mcat-item{background:#f8f8fc;border-color:#e0e0ea}
.light .mcat-item.on{background:#fff3ef;border-color:var(--acc)}
.light .mcat-expanded{background:#fff;border-color:#e0e0ea}
.light .mcat-sub{background:#f0f1f5;border-color:#d0d0e0;color:#080808}
.light .prof-hero{background:#fff;border-color:#e0e0ea}
.light .prof-stat{background:#f0f1f5}
.light .reward-hero{background:linear-gradient(135deg,#fff3ef,#fff8f5);border-color:var(--acc)20}
.light .reward-milestone{background:#fff;border-color:#e0e0ea}
.light .pts-hint{background:#fff3ef;border-color:var(--acc)20}
.light .type-tab{background:#f8f8fc;border-color:#e0e0ea}
.light .type-tab.on{background:#fff3ef;border-color:var(--acc)}
.light .chk{background:#f8f8fc;border-color:#e0e0ea}
.light .chk.on{background:#fff3ef;border-color:var(--acc)30}
.light .loc-field{background:#f8f8fc;border-color:#e0e0ea}
.light .bulk-reward-card{background:#f8f8fc;border-color:#e0e0ea}
.light .referral-card{background:#f8f8fc;border-color:#e0e0ea}
.light .staff-card{background:#f8f8fc;border-color:#e0e0ea}
.light .wh-card{background:#f0f1f5;border-color:#e0e0ea}
.light .dup-pair{background:#f8f8fc;border-color:#e0e0ea}
.light .dup-card{background:#fff;border-color:#e0e0ea}
.light .tmpl-card{background:#f8f8fc;border-color:#e0e0ea}
.light .ntab{color:#080808899}
.light .ntab:hover{color:#080808}
.light .ntab.on{color:#080808}
.light .logo{color:#080808}
@media(max-width:768px){
  .disc-main.hidden-mob{display:none}
  .discovery{flex-direction:column}
  .disc-sidebar{width:100%}
  .stats-row{grid-template-columns:repeat(2,1fr)}
  .fg{grid-template-columns:1fr}
  .fg3{grid-template-columns:1fr 1fr}
  .admin-nav{display:none}
  .nav-tabs{display:none}
}
`;

// ============================================================
// CHECKLIST FIELDS
// ============================================================

const FREE_EMAIL_DOMAINS = ["gmail.com","yahoo.com","hotmail.com","outlook.com","rediffmail.com","ymail.com","icloud.com","live.com"];
const isWorkEmail = (email) => { if (!email || !email.includes("@")) return false; const domain = email.split("@")[1]?.toLowerCase(); return !FREE_EMAIL_DOMAINS.includes(domain); };

const STORE_CHECKLIST = [
  "Owner Name","Business Email","GST Number","Working Hours",
  "Parking Available","Home Delivery","Credit Available","WhatsApp Active",
  "Instagram Page","Website","YouTube Channel","Trade License",
  "Export License","ISO Certified","BIS Certified","Showroom",
];

const INDIVIDUAL_CHECKLIST = [
  "LinkedIn Profile","Facebook Profile","WhatsApp Active","Email Verified",
  "Portfolio Available","GST Registered","PAN Verified","Aadhar Verified",
  "Site References","Awards/Recognition","Association Member","Export Experience",
];

// ============================================================
// BULK TEMPLATES
// ============================================================
const BULK_TEMPLATES = [
  {
    id: "stores", icon: "🏪", name: "Stores / Businesses",
    desc: "Hardware, tiles, plywood dealers etc.",
    required: ["StoreName","Phone","City"],
    optional: ["State","Pincode","Category","BusinessType","OwnerName","Email","GST","Brands","Address"],
    sample: "StoreName,Phone,City,State,Pincode,Category,BusinessType,OwnerName,Email,GST,Brands,Address\nSharma Hardware,9820012345,Mumbai,Maharashtra,400053,Hardware,Retailer,Rajesh Sharma,sharma@gmail.com,27AABCS1429B1ZB,Dorma|Hettich,Shop 5 Link Road\nDelhi Tiles Centre,9811234567,Delhi,Delhi,110020,Ceramic Tiles,Distributor,,,,Kajaria|Somany,Plot 12 Okhla"
  },
  {
    id: "contractors", icon: "🔧", name: "Contractors / Individuals",
    desc: "Contractors, masons, supervisors etc.",
    required: ["Name","Mobile","City"],
    optional: ["State","Category","BusinessType","Email","CompanyName","LinkedIn","Facebook","Website"],
    sample: "Name,Mobile,City,State,Category,BusinessType,Email,CompanyName,LinkedIn\nAmit Verma,9988776655,Delhi,Haryana,Interior Solutions,Contractor,amit@gmail.com,Verma Constructions,\nSunita Builders,9876543210,Mumbai,Maharashtra,Construction,Contractor,,,linkedin.com/in/sunita"
  },
  {
    id: "architects", icon: "📐", name: "Architects / Designers",
    desc: "Architects, interior designers, PMCs etc.",
    required: ["Name","Mobile","City"],
    optional: ["State","FirmName","Specialization","Email","LinkedIn","Website","ProjectTypes"],
    sample: "Name,Mobile,City,State,FirmName,Specialization,Email,LinkedIn,Website\nRahul Mehta,9867001234,Mumbai,Maharashtra,Mehta Associates,Residential & Commercial,rahul@mehta.in,,mehta-arch.com\nPreeti Sharma,9811122334,Delhi,Delhi,Design Studio,Interior Design,preeti@ds.in,linkedin.com/in/preeti,"
  },
];

// ============================================================
// COMPONENTS
// ============================================================

function Toast({ msg, type, show }) {
  return <div className={`toast ${type} ${show ? "show" : ""}`}>{type === "ok" ? "✓ " : "✗ "}{msg}</div>;
}

function ConfidenceBar({ value, size = "sm" }) {
  const color = value >= 80 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  if (size === "sm") return (
    <div className="conf-bar"><div className="conf-fill" style={{ width: `${value}%`, background: color }} /></div>
  );
  return (
    <div className="conf-bar2"><div className="conf-fill2" style={{ width: `${value}%`, background: color }} /></div>
  );
}


// ============================================================
// MOCK STAFF DATA
// ============================================================
const MOCK_STAFF = [
  { id:"st1", storeId:"s1", name:"Deepak Mehta", designation:"Sales Manager", workEmail:"deepak@sharmatools.com", personalEmail:"deepak.m@gmail.com", phone:"9876543210", linkedin:"linkedin.com/in/deepakmehta", skills:["Hardware","Architectural Fittings","B2B Sales"], workHistory:[{store:"Sharma Hardware & Tools",storeId:"s1",role:"Sales Manager",from:"2021",to:"Present",city:"Mumbai"},{store:"BuildMart India",storeId:"",role:"Sales Executive",from:"2018",to:"2021",city:"Pune"},{store:"Metro Hardware",storeId:"",role:"Counter Sales",from:"2016",to:"2018",city:"Mumbai"}] },
  { id:"st2", storeId:"s1", name:"Sunita Rao", designation:"Product Specialist", workEmail:"sunita@sharmatools.com", personalEmail:"sunita.r@gmail.com", phone:"9867001234", linkedin:"", skills:["Paints","Construction Chemicals","Technical Support"], workHistory:[{store:"Sharma Hardware & Tools",storeId:"s1",role:"Product Specialist",from:"2022",to:"Present",city:"Mumbai"},{store:"Asian Paints Retail",storeId:"",role:"Tinting Specialist",from:"2019",to:"2022",city:"Mumbai"}] },
];

// Multi-category selector
function MultiCategorySelector({ selected, onChange }) {
  const [catSelections, setCatSelections] = useState(
    (selected||[]).reduce((acc,s) => ({...acc,[s.category]:{sub:s.subCategory||"",prods:s.productType?s.productType.split(",").map(p=>p.trim()):[]}})  ,{})
  );

  const toggleCat = (cat) => {
    const next = {...catSelections};
    if (next[cat]) { delete next[cat]; } else { next[cat] = {sub:"",prods:[]}; }
    setCatSelections(next);
    onChange(Object.keys(next).map(c=>({category:c,subCategory:next[c].sub,productType:next[c].prods.join(", ")})));
  };

  const setSub = (cat,sub) => {
    const next = {...catSelections,[cat]:{...catSelections[cat],sub,prods:[]}};
    setCatSelections(next);
    onChange(Object.keys(next).map(c=>({category:c,subCategory:next[c].sub,productType:next[c].prods.join(", ")})));
  };

  const toggleProd = (cat,prod) => {
    const cur = catSelections[cat]?.prods||[];
    const prods = cur.includes(prod)?cur.filter(p=>p!==prod):[...cur,prod];
    const next = {...catSelections,[cat]:{...catSelections[cat],prods}};
    setCatSelections(next);
    onChange(Object.keys(next).map(c=>({category:c,subCategory:next[c].sub,productType:next[c].prods.join(", ")})));
  };

  const selectedCats = Object.keys(catSelections);

  return (
    <div>
      <div style={{fontSize:11,color:"#080808",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Select all categories this store carries</div>
      <div className="mcat-grid">
        {Object.keys(CATEGORY_TREE).map(cat=>(
          <div key={cat} className={`mcat-item ${catSelections[cat]?"on":""}`} onClick={()=>toggleCat(cat)}>
            <div className="mcat-label">{cat}</div>
            <div className="mcat-count">{Object.keys(CATEGORY_TREE[cat]).length} sub-types</div>
          </div>
        ))}
      </div>
      {selectedCats.length>0&&(
        <div>
          <div style={{fontSize:11,color:"#080808",margin:"10px 0 8px",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Drill down — optional detail per category</div>
          {selectedCats.map(cat=>{
            const subs=Object.keys(CATEGORY_TREE[cat]);
            const curSub=catSelections[cat]?.sub;
            const prods=curSub?CATEGORY_TREE[cat][curSub]:[];
            const curProds=catSelections[cat]?.prods||[];
            return(
              <div key={cat} className="mcat-expanded">
                <div className="mcat-exp-title">
                  <span>📦 {cat}</span>
                  <span style={{fontSize:11,color:"#080808",fontWeight:400,cursor:"pointer"}} onClick={()=>toggleCat(cat)}>× remove</span>
                </div>
                <div style={{fontSize:11,color:"#080808",marginBottom:5,fontWeight:600}}>Sub-category</div>
                <div className="mcat-sub-row" style={{marginBottom:10}}>
                  {subs.map(s=><div key={s} className={`mcat-sub ${curSub===s?"on":""}`} onClick={()=>setSub(cat,s)}>{s}</div>)}
                </div>
                {curSub&&prods.length>0&&<>
                  <div style={{fontSize:11,color:"#080808",marginBottom:5,fontWeight:600}}>Product Types</div>
                  <div className="mcat-sub-row">
                    {prods.map(p=><div key={p} className={`mcat-prod ${curProds.includes(p)?"on":""}`} onClick={()=>toggleProd(cat,p)}>{p}</div>)}
                  </div>
                </>}
              </div>
            );
          })}
          <div style={{paddingTop:6,display:"flex",flexWrap:"wrap"}}>
            {selectedCats.map(c=>(
              <div key={c} className="sel-cat-tag">{c}{catSelections[c]?.sub?` › ${catSelections[c].sub}`:""}<span className="sel-cat-x" onClick={()=>toggleCat(c)}>×</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffModal({ staff, onClose }) {
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

function StaffProfilePage({ user }) {
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


// ============================================================
// DEALS PAGE
// ============================================================
function DealsPage() {
  return (
    <div className="deals-pg">
      <div className="deals-icon">🏷</div>
      <div className="deals-title">Deals & Offers</div>
      <div className="deals-sub">Exclusive deals on building materials, tools, and services — curated for TIN members across India.</div>
      <div className="deals-badge">Coming Soon</div>
      <div style={{fontSize:13,color:"#080808",marginTop:12}}>Be among the first to know when deals launch.</div>
    </div>
  );
}

// ============================================================
// REWARDS PAGE
// ============================================================
function RewardsPage({ user, onMessageAdmin }) {
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
  const refCode = `TIN${(user.name||"USER").toUpperCase().replace(/\s/g,"").substring(0,5)}${Math.floor(Math.random()*1000)+100}`;

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
          <div className="sc-sub">Earn +50 points for every new industry contributor who joins using your referral code and gets validated.</div>
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


// ============================================================
// ADMIN LOGIN PAGE — separate from main login
// ============================================================
function AdminLoginPage({ onAdminLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ADMIN_EMAIL = "enayathsheik@gmail.com";

  const handleLogin = async () => {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        onAdminLogin({ name: "Admin", email, workEmail: email, personalEmail: email, role: "admin", points: 0, storesAdded: 0, citiesCovered: 0, validationStatus: "active", uid: cred.user.uid });
      } else {
        setError("Access denied. Admin credentials only.");
        await signOut(auth);
      }
    } catch(err) {
      setError("Invalid credentials.");
    }
    setLoading(false);
  };

  return (
    <div className="login-pg">
      <div className="login-card" style={{maxWidth:360}}>
        <div className="login-logo">Trade Intelligence Network</div>
        <div className="login-title"><em>Admin</em> Access</div>
        <div className="login-sub" style={{marginBottom:20}}>Restricted area. Authorized personnel only.</div>
        {error && <div style={{background:"var(--danger)10",border:"1px solid var(--danger)25",borderRadius:"var(--r)",padding:"10px 14px",fontSize:13,color:"var(--danger)",marginBottom:14}}>{error}</div>}
        <div className="login-fields">
          <div className="lf"><label>Admin Email</label><input className="fi" type="email" placeholder="admin@tin.in" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="lf"><label>Password</label><input className="fi" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
        </div>
        <button className="btn-login" onClick={handleLogin} disabled={loading}>{loading ? "Verifying..." : "Access Admin Panel →"}</button>
        <div className="login-sw"><a href="/" style={{color:"#080808",fontSize:12,textDecoration:"none"}}>← Back to TIN</a></div>
      </div>
    </div>
  );
}


// ============================================================
// MOCK EXHIBITIONS DATA
// ============================================================
const EXHIBITIONS = [
  { id:"e1", name:"ACETECH Mumbai 2025", date:"Jun 10", venue:"Bombay Exhibition Centre, NESCO, Goregaon", city:"Mumbai", url:"#" },
  { id:"e2", name:"IndiaWood 2025", date:"Jun 25", venue:"Bangalore International Exhibition Centre", city:"Bengaluru", url:"#" },
  { id:"e3", name:"Surfaces & Coatings Expo", date:"Jul 5", venue:"Pragati Maidan, New Delhi", city:"Delhi", url:"#" },
  { id:"e4", name:"Index India 2025", date:"Jul 18", venue:"Bombay Exhibition Centre", city:"Mumbai", url:"#" },
  { id:"e5", name:"BuildTech Expo", date:"Aug 2", venue:"Hyderabad International Convention Centre", city:"Hyderabad", url:"#" },
];

// ============================================================
// RETAILER DASHBOARD
// ============================================================
function RetailerDashboard({ user, stores, onNavigate }) {
  const [activeTab, setActiveTab] = useState("home");
  const [storeProfile, setStoreProfile] = useState({
    storeName: user.storeName || "",
    address: user.address || "",
    city: user.city || "",
    state: user.state || "",
    pincode: user.pincode || "",
    phone: user.phone || "",
    whatsapp: user.whatsapp || "",
    instagram: user.instagram || "",
    facebook: user.facebook || "",
    website: user.website || "",
    categories: user.categories || [],
    brands: user.brands || "",
    gst: user.gst || "",
    verificationStatus: user.verificationStatus || "pending",
  });
  const [locations, setLocations] = useState(user.locations || []);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name:"", address:"", city:"", phone:"", whatsapp:"" });
  const [events, setEvents] = useState(user.customEvents || []);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name:"", date:"", venue:"", city:"" });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analytics, setAnalytics] = useState({ instagram: user.igFollowers||0, facebook: user.fbFollowers||0, google: user.googleRating||0, profileViews: 1248 });

  // Count products from categories
  const totalCategories = (storeProfile.categories||[]).length;
  const totalSubCats = (storeProfile.categories||[]).reduce((s,c) => s + (c.subCategory?1:0), 0);
  const totalProducts = (storeProfile.categories||[]).reduce((s,c) => s + (c.productType ? c.productType.split(",").length : 0), 0);

  const handleShare = () => {
    const text = `${storeProfile.storeName}\n${storeProfile.address}, ${storeProfile.city}\nPhone: ${storeProfile.phone}${storeProfile.whatsapp ? "\nWhatsApp: " + storeProfile.whatsapp : ""}${storeProfile.website ? "\nWeb: " + storeProfile.website : ""}`;
    navigator.clipboard?.writeText(text);
    alert("Store contact copied to clipboard!");
  };

  const saveProfile = async () => {
    try {
      if (user.uid) {
        await updateDoc(doc(db, "users", user.uid), { ...storeProfile, locations, customEvents: events });
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { console.log("Save error:", e); setEditing(false); }
  };

  const addLocation = () => {
    if (!newLocation.name) return;
    setLocations(l => [...l, { ...newLocation, id: Date.now().toString() }]);
    setNewLocation({ name:"", address:"", city:"", phone:"", whatsapp:"" });
    setShowAddLocation(false);
  };

  const addEvent = () => {
    if (!newEvent.name) return;
    setEvents(e => [...e, { ...newEvent, id: Date.now().toString(), custom: true }]);
    setNewEvent({ name:"", date:"", venue:"", city:"" });
    setShowAddEvent(false);
  };

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* SIDEBAR NAV */}
      <div style={{width:200,flexShrink:0,background:"#fff",borderRight:"1px solid #e0e0e0",padding:"16px 12px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:".12em",color:"#e85a2a",padding:"4px 10px",marginBottom:8}}>BUSINESS PORTAL</div>
        {[["home","🏠","My Business"],["discover","🔍","Discover"],["staff","👥","Staff"],["deals","🏷","Deals"],["profile","👤","Profile"]].map(([id,icon,label]) => (
          <div key={id}
            onClick={() => setActiveTab(id)}
            style={{padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:activeTab===id?"#e85a2a":"#080808",background:activeTab===id?"#fff3ef":"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
            <span style={{fontSize:15}}>{icon}</span>{label}
            {id==="deals"&&<span style={{fontSize:9,background:"#e85a2a",color:"white",padding:"1px 5px",borderRadius:10,fontWeight:700,marginLeft:"auto"}}>NEW</span>}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"12px 10px",background:"#fff8f5",borderRadius:8,border:"1px solid #fde0d0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#e85a2a",marginBottom:4}}>Profile Completeness</div>
          <div style={{fontSize:22,fontWeight:800,color:"#080808",fontFamily:"'Barlow Condensed',sans-serif"}}>
            {Math.min(100, 20 + (storeProfile.phone?10:0) + (storeProfile.address?10:0) + (storeProfile.website?10:0) + (storeProfile.instagram?10:0) + (storeProfile.categories?.length>0?10:0) + (storeProfile.brands?10:0) + (storeProfile.gst?10:0) + (storeProfile.whatsapp?10:0))}%
          </div>
          <div style={{height:4,background:"#f0f0f0",borderRadius:2,marginTop:4,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#e85a2a",borderRadius:2,width:`${Math.min(100, 20 + (storeProfile.phone?10:0) + (storeProfile.address?10:0) + (storeProfile.website?10:0) + (storeProfile.instagram?10:0) + (storeProfile.categories?.length>0?10:0) + (storeProfile.brands?10:0) + (storeProfile.gst?10:0) + (storeProfile.whatsapp?10:0))}%`}}/>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,overflowY:"auto",background:"#f5f5f5"}}>

        {/* ---- HOME TAB ---- */}
        {activeTab === "home" && (
          <div style={{padding:24,maxWidth:900,margin:"0 auto"}}>

            {saved && <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 16px",fontSize:13,color:"#16a34a",marginBottom:14}}>✓ Profile saved successfully!</div>}

            {/* STORE IDENTITY CARD */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  {editing ? (
                    <input style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,border:"none",borderBottom:"2px solid #e85a2a",outline:"none",color:"#080808",width:"100%",background:"transparent"}}
                      value={storeProfile.storeName} onChange={e => setStoreProfile(s=>({...s,storeName:e.target.value}))} placeholder="Store Name" />
                  ) : (
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"#080808"}}>{storeProfile.storeName || user.name || "Your Store Name"}</div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    {storeProfile.verificationStatus==="verified"
                      ? <span style={{fontSize:11,color:"#16a34a",fontWeight:700,background:"#f0fdf4",padding:"2px 8px",borderRadius:20,border:"1px solid #bbf7d0"}}>✓ Verified Business</span>
                      : <span style={{fontSize:11,color:"#d97706",fontWeight:700,background:"#fffbeb",padding:"2px 8px",borderRadius:20,border:"1px solid #fde68a"}}>⏳ Verification Pending</span>
                    }
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {!editing
                    ? <button onClick={()=>setEditing(true)} style={{padding:"7px 14px",borderRadius:8,background:"#fff3ef",border:"1px solid #fde0d0",color:"#e85a2a",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button>
                    : <>
                        <button onClick={saveProfile} style={{padding:"7px 14px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button>
                        <button onClick={()=>setEditing(false)} style={{padding:"7px 14px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                      </>
                  }
                  <button onClick={handleShare} style={{padding:"7px 14px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Share</button>
                </div>
              </div>

              {/* ADDRESS + CONTACT */}
              {editing ? (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                  {[["Address","address","123 Shop, Street"],["City","city","Mumbai"],["State","state","Maharashtra"],["Pincode","pincode","400001"],["Phone","phone","9820012345"],["WhatsApp","whatsapp","9820012345"],["Instagram","instagram","@yourstore"],["Facebook","facebook","facebook.com/yourstore"],["Website","website","www.yourstore.com"],["GST Number","gst","27AABCS1429B1ZB"]].map(([label,key,ph]) => (
                    <div key={key}>
                      <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                      <input className="fi" placeholder={ph} value={storeProfile[key]||""} onChange={e=>setStoreProfile(s=>({...s,[key]:e.target.value}))} style={{fontSize:12}} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{fontSize:13,color:"#080808",marginBottom:12}}>📍 {storeProfile.address}{storeProfile.city?`, ${storeProfile.city}`:""}{storeProfile.state?`, ${storeProfile.state}`:""}{storeProfile.pincode?` - ${storeProfile.pincode}`:""}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {storeProfile.phone&&<a href={`tel:${storeProfile.phone}`} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞 Call</a>}
                    {storeProfile.whatsapp&&<a href={`https://wa.me/91${storeProfile.whatsapp}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:12,fontWeight:700,textDecoration:"none"}}>💬 WhatsApp</a>}
                    {storeProfile.instagram&&<a href={`https://instagram.com/${storeProfile.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#fdf4ff",border:"1px solid #e9d5ff",color:"#7c3aed",fontSize:12,fontWeight:700,textDecoration:"none"}}>📸 Instagram</a>}
                    {storeProfile.facebook&&<a href={storeProfile.facebook} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",fontSize:12,fontWeight:700,textDecoration:"none"}}>📘 Facebook</a>}
                    {storeProfile.website&&<a href={storeProfile.website} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#080808",fontSize:12,fontWeight:700,textDecoration:"none"}}>🌐 Website</a>}
                  </div>
                </>
              )}
            </div>

            {/* STATS ROW */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[[totalProducts||0,"Products","📦"],[totalCategories||0,"Categories","🏷"],[totalSubCats||0,"Sub-categories","📋"],[locations.length+1,"Locations","📍"]].map(([v,l,icon]) => (
                <div key={l} style={{background:"#fff",borderRadius:10,border:"1px solid #e0e0e0",padding:16,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:"#e85a2a"}}>{v}</div>
                  <div style={{fontSize:11,color:"#080808",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>

            {/* PRODUCT CATEGORIES */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>Product Portfolio</div>
                <button onClick={()=>setEditing(true)} style={{padding:"6px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Products</button>
              </div>
              {(storeProfile.categories||[]).length === 0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:"#888",fontSize:13}}>No products added yet. Click Edit to add your product categories.</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                  {(storeProfile.categories||[]).map((c,i) => (
                    <div key={i} style={{background:"#f8f8f8",borderRadius:8,padding:10,border:"1px solid #e8e8e8"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#e85a2a",marginBottom:3}}>{c.category}</div>
                      {c.subCategory&&<div style={{fontSize:11,color:"#080808",marginBottom:2}}>{c.subCategory}</div>}
                      {c.productType&&<div style={{fontSize:10,color:"#555"}}>{c.productType}</div>}
                    </div>
                  ))}
                </div>
              )}
              {editing && (
                <div style={{marginTop:14,borderTop:"1px solid #f0f0f0",paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#080808",marginBottom:8}}>Edit Categories</div>
                  <MultiCategorySelector selected={storeProfile.categories||[]} onChange={cats=>setStoreProfile(s=>({...s,categories:cats}))} />
                </div>
              )}
            </div>

            {/* LOCATIONS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>My Locations</div>
                <button onClick={()=>setShowAddLocation(true)} style={{padding:"6px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Location</button>
              </div>

              {/* Main location */}
              <div style={{background:"#fff8f5",borderRadius:10,padding:14,border:"1px solid #fde0d0",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{storeProfile.storeName||"Main Store"} <span style={{fontSize:10,background:"#e85a2a",color:"white",padding:"1px 6px",borderRadius:10,marginLeft:4}}>Main</span></div>
                    <div style={{fontSize:12,color:"#555",marginTop:3}}>{storeProfile.address}{storeProfile.city?`, ${storeProfile.city}`:""}</div>
                    <div style={{fontSize:12,color:"#080808",fontWeight:600,marginTop:4}}>{storeProfile.phone}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {storeProfile.phone&&<a href={`tel:${storeProfile.phone}`} style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞</a>}
                    {storeProfile.whatsapp&&<a href={`https://wa.me/91${storeProfile.whatsapp}`} target="_blank" rel="noreferrer" style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>💬</a>}
                  </div>
                </div>
              </div>

              {/* Additional locations */}
              {locations.map((loc,i) => (
                <div key={loc.id||i} style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e8e8e8",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{loc.name}</div>
                      <div style={{fontSize:12,color:"#555",marginTop:3}}>{loc.address}{loc.city?`, ${loc.city}`:""}</div>
                      <div style={{fontSize:12,color:"#080808",fontWeight:600,marginTop:4}}>{loc.phone}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {loc.phone&&<a href={`tel:${loc.phone}`} style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞</a>}
                      {loc.whatsapp&&<a href={`https://wa.me/91${loc.whatsapp}`} target="_blank" rel="noreferrer" style={{padding:"4px 8px",borderRadius:6,background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",fontSize:11,fontWeight:700,textDecoration:"none"}}>💬</a>}
                      <button onClick={()=>setLocations(l=>l.filter((_,idx)=>idx!==i))} style={{padding:"4px 8px",borderRadius:6,background:"#fff0f0",border:"1px solid #fecaca",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Location Form */}
              {showAddLocation && (
                <div style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e0e0e0",marginTop:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#080808",marginBottom:10}}>Add New Location</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["Branch Name","name","e.g. Branch 1"],["Address","address","Street address"],["City","city","City"],["Phone","phone","Mobile number"],["WhatsApp","whatsapp","WhatsApp number"]].map(([label,key,ph]) => (
                      <div key={key}>
                        <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                        <input className="fi" placeholder={ph} value={newLocation[key]||""} onChange={e=>setNewLocation(l=>({...l,[key]:e.target.value}))} style={{fontSize:12}} />
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={addLocation} style={{padding:"7px 16px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add Location</button>
                    <button onClick={()=>setShowAddLocation(false)} style={{padding:"7px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* ANALYTICS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808",marginBottom:14}}>Analytics Overview</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[["📸","Instagram",analytics.instagram,"Followers"],["📘","Facebook",analytics.facebook,"Followers"],["⭐","Google Rating",analytics.google,"Stars"]].map(([icon,label,val,unit]) => (
                  <div key={label} style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e8e8e8",textAlign:"center"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#e85a2a"}}>{val||"—"}</div>
                    <div style={{fontSize:11,color:"#080808",fontWeight:600}}>{label}</div>
                    <div style={{fontSize:10,color:"#555"}}>{unit}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12,color:"#555",marginBottom:8}}>Update your social stats:</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["Instagram Followers","instagram"],["Facebook Followers","facebook"],["Google Rating","google"]].map(([label,key]) => (
                  <div key={key}>
                    <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                    <input className="fi" placeholder="0" type="number" value={analytics[key]||""} onChange={e=>setAnalytics(a=>({...a,[key]:e.target.value}))} style={{fontSize:12}} />
                  </div>
                ))}
              </div>
            </div>

            {/* EVENTS */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e0e0e0",padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:"#080808"}}>Upcoming Exhibitions & Events</div>
                <button onClick={()=>setShowAddEvent(true)} style={{padding:"6px 12px",borderRadius:8,background:"#080808",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Event</button>
              </div>
              {[...EXHIBITIONS, ...events].map((ev,i) => (
                <div key={ev.id||i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:"1px solid #f0f0f0"}}>
                  <div style={{textAlign:"center",background:"#fff3ef",borderRadius:8,padding:"8px 12px",minWidth:48,flexShrink:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:"#e85a2a",lineHeight:1}}>{ev.date?.split(" ")[0]}</div>
                    <div style={{fontSize:10,fontWeight:700,color:"#e85a2a"}}>{ev.date?.split(" ")[1]}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#080808"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>{ev.venue}</div>
                    <div style={{fontSize:11,color:"#080808",marginTop:1}}>📍 {ev.city}</div>
                  </div>
                  {!ev.custom && <button style={{padding:"5px 12px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:11,fontWeight:700,cursor:"pointer"}}>Register</button>}
                  {ev.custom && <button onClick={()=>setEvents(e=>e.filter((_,idx)=>idx!==i-EXHIBITIONS.length))} style={{padding:"5px 10px",borderRadius:8,background:"#fff0f0",border:"1px solid #fecaca",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>}
                </div>
              ))}
              {showAddEvent && (
                <div style={{background:"#f8f8f8",borderRadius:10,padding:14,border:"1px solid #e0e0e0",marginTop:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#080808",marginBottom:10}}>Add Your Event</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["Event Name","name","e.g. Showroom Launch"],["Date","date","e.g. Jul 15"],["Venue","venue","Venue name"],["City","city","City"]].map(([label,key,ph]) => (
                      <div key={key}>
                        <div style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
                        <input className="fi" placeholder={ph} value={newEvent[key]||""} onChange={e=>setNewEvent(ev=>({...ev,[key]:e.target.value}))} style={{fontSize:12}} />
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={addEvent} style={{padding:"7px 16px",borderRadius:8,background:"#e85a2a",border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer"}}>Add Event</button>
                    <button onClick={()=>setShowAddEvent(false)} style={{padding:"7px 16px",borderRadius:8,background:"#f5f5f5",border:"1px solid #e0e0e0",color:"#080808",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---- DISCOVER TAB ---- */}
        {activeTab === "discover" && <DiscoveryPage stores={stores} selectedCity={null} />}

        {/* ---- STAFF TAB ---- */}
        {activeTab === "staff" && <StaffProfilePage user={user} />}

        {/* ---- DEALS TAB ---- */}
        {activeTab === "deals" && (
          <div style={{padding:24,maxWidth:700,margin:"0 auto"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:"#080808",marginBottom:4}}>Deals & Tools</div>
            <div style={{fontSize:13,color:"#555",marginBottom:24}}>Grow your business with TIN tools and offers</div>
            {[
              {icon:"🤖",title:"AI Visualiser",desc:"Let your customers visualise your products in their space using AI. Upload product images and generate room visualisations instantly.",status:"coming"},
              {icon:"📸",title:"Upload Client Testimonials",desc:"Showcase happy customers. Upload photos and reviews from your clients to build trust with new buyers.",status:"coming"},
              {icon:"🎨",title:"Design Inspiration Gallery",desc:"Upload design inspiration images featuring your products. Help architects and designers discover your range.",status:"coming"},
              {icon:"📊",title:"Business Analytics Pro",desc:"Deep analytics — track profile views, enquiries, WhatsApp clicks, catalogue downloads and more.",status:"coming"},
              {icon:"🏷",title:"Featured Listing",desc:"Get your business featured at the top of search results in your city and category.",status:"coming"},
            ].map(d => (
              <div key={d.title} style={{background:"#fff",borderRadius:12,border:"1px solid #e0e0e0",padding:20,marginBottom:12,display:"flex",alignItems:"center",gap:16}}>
                <div style={{fontSize:32,flexShrink:0}}>{d.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:"#080808",marginBottom:3}}>{d.title}</div>
                  <div style={{fontSize:12,color:"#555",lineHeight:1.5}}>{d.desc}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,background:"#e85a2a",color:"white",padding:"3px 8px",borderRadius:10,whiteSpace:"nowrap",flexShrink:0}}>Coming Soon</span>
              </div>
            ))}
          </div>
        )}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === "profile" && <ProfilePage user={user} />}

      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("contributor");
  const [email, setEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isContrib = role === "contributor";
  const comingSoonRoles = ["consumer", "contractor", "architect"];
  const visibleRoles = ROLES.filter(r => r.id !== "manufacturer" && r.id !== "admin");

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSent(true);
    } catch(err) {
      alert("Could not send reset email. Please check the address.");
    }
  };

  const handleSubmit = async () => {
    const emailToUse = (mode === "register" && isContrib ? workEmail : email).trim();
    const passToUse = pass.trim();
    if (!emailToUse || !passToUse) {
      alert("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        // LOGIN — role loaded from Firebase automatically
        const cred = await signInWithEmailAndPassword(auth, emailToUse, passToUse);
        const profile = await getUserProfile(cred.user.uid);
        if (profile) {
          onLogin({ ...profile, uid: cred.user.uid });
        } else {
          // Profile not found — create basic one
          const basicProfile = { name: emailToUse.split("@")[0], email: emailToUse, workEmail: emailToUse, personalEmail: "", role: "contributor", linkedin: "", company: "", points: 0, storesAdded: 0, citiesCovered: 0, validationStatus: "n/a", createdAt: new Date().toISOString(), uid: cred.user.uid };
          await saveUserProfile(cred.user.uid, basicProfile);
          onLogin(basicProfile);
        }
      } else {
        // REGISTER — role selection matters here
        const cred = await createUserWithEmailAndPassword(auth, emailToUse, passToUse);
        const ud = {
          name: name || emailToUse.split("@")[0],
          email: emailToUse,
          workEmail: isContrib ? workEmail : emailToUse,
          personalEmail,
          role,
          linkedin,
          company: isContrib ? workEmail.split("@")[1]?.split(".")[0] || "" : "",
          points: 0,
          storesAdded: 0,
          citiesCovered: 0,
          validationStatus: isContrib ? (linkedin ? "pending" : "unvalidated") : "n/a",
          createdAt: new Date().toISOString(),
          uid: cred.user.uid
        };
        await saveUserProfile(cred.user.uid, ud);
        onLogin(ud);
      }
    } catch(err) {
      const msg = err.message
        .replace("Firebase: ", "")
        .replace("(auth/email-already-in-use)", "Email already registered — please sign in.")
        .replace("(auth/wrong-password)", "Wrong password.")
        .replace("(auth/user-not-found)", "No account found — please register.")
        .replace("(auth/invalid-credential)", "Invalid email or password.")
        .replace("(auth/weak-password)", "Password must be at least 6 characters.");
      alert(msg);
    }
    setLoading(false);
  };

  // Forgot password screen
  if (showForgot) return (
    <div className="login-pg">
      <div className="login-card">
        <div className="login-logo">Trade Intelligence Network</div>
        <div className="login-title">Reset <em>Password</em></div>
        <div className="login-sub">Enter your registered email — we will send a reset link.</div>
        {forgotSent ? (
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"var(--r)",padding:"12px 16px",fontSize:13,color:"#16a34a",marginBottom:14}}>
            ✓ Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
          </div>
        ) : (
          <div className="login-fields">
            <div className="lf"><label>Email Address</label><input className="fi" type="email" placeholder="your@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} /></div>
          </div>
        )}
        {!forgotSent && <button className="btn-login" onClick={handleForgotPassword}>Send Reset Link →</button>}
        <div className="login-sw" style={{marginTop:14}}><span onClick={() => { setShowForgot(false); setForgotSent(false); }}>← Back to Login</span></div>
      </div>
    </div>
  );

  return (
    <div className="login-pg">
      <div className="login-card">
        <div className="login-logo">Trade Intelligence Network</div>
        <div className="login-title">Welcome to <em>TIN</em></div>
        <div className="login-sub">
          {mode === "login" ? "Sign in to your account." : "Create your TIN account — select your role first."}
        </div>

        {/* ROLE SELECTOR — only shown during registration */}
        {mode === "register" && (
          <div className="role-grid" style={{marginBottom:16}}>
            {visibleRoles.map(r => {
              const isComingSoon = comingSoonRoles.includes(r.id);
              return (
                <div key={r.id}
                  className={`role-opt ${role === r.id ? "on" : ""}`}
                  onClick={() => !isComingSoon && setRole(r.id)}
                  style={isComingSoon ? {opacity:0.5,cursor:"default"} : {}}>
                  <div className="role-icon">{r.icon}</div>
                  <div className="role-lbl">{r.label}</div>
                  {isComingSoon
                    ? <div style={{fontSize:10,color:"#e85a2a",fontWeight:700,marginTop:2}}>Coming Soon</div>
                    : <div className="role-desc">{r.desc}</div>
                  }
                </div>
              );
            })}
          </div>
        )}

        {/* CONTRIBUTOR EXTRA FIELDS — only on register */}
        {mode === "register" && isContrib && (
          <div className="contrib-note">✍️ Contributors need a company work email. LinkedIn is optional.</div>
        )}

        <div className="login-fields">
          {mode === "register" && (
            <div className="lf"><label>Full Name</label><input className="fi" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} /></div>
          )}

          {mode === "register" && isContrib ? (
            <>
              <div className="lf">
                <label>Work Email <span style={{color:"#e85a2a"}}>*</span></label>
                <input className="fi" type="email" placeholder="you@yourcompany.com" value={workEmail} onChange={e => setWorkEmail(e.target.value)} />
              </div>
              <div className="lf"><label>Personal Email (backup)</label><input className="fi" type="email" placeholder="you@gmail.com" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></div>
              <div className="lf"><label>LinkedIn <span style={{fontSize:10,color:"#555",fontWeight:400}}>(optional)</span></label><input className="fi" placeholder="linkedin.com/in/yourname" value={linkedin} onChange={e => setLinkedin(e.target.value)} /></div>
            </>
          ) : (
            <>
              <div className="lf">
                <label>Email</label>
                <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
              {mode === "register" && (
                <div className="lf"><label>Personal Email (backup)</label><input className="fi" type="email" placeholder="backup@gmail.com" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></div>
              )}
            </>
          )}

          <div className="lf">
            <label>Password</label>
            <input className="fi" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
        </div>

        <button className="btn-login" onClick={handleSubmit} disabled={loading} style={{opacity:loading?0.7:1}}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>

        {mode === "login" && (
          <div style={{textAlign:"center",marginTop:10}}>
            <span onClick={() => setShowForgot(true)} style={{fontSize:12,color:"#e85a2a",cursor:"pointer",fontWeight:600}}>Forgot password?</span>
          </div>
        )}

        <div className="login-sw">
          {mode === "login"
            ? <>New to TIN? <span onClick={() => setMode("register")}>Create account</span></>
            : <>Already have account? <span onClick={() => setMode("login")}>Sign in</span></>
          }
        </div>
      </div>
    </div>
  );
}

function HeroPage({ onCitySelect, selectedCity, onExplore, onAdd }) {
  const [search, setSearch] = useState("");
  const topCities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad", "Kolkata", "Jaipur", "Surat"];
  const filtered = search ? CITIES.filter(c => c.toLowerCase().includes(search.toLowerCase())) : CITIES;

  return (
    <div className="hero">
      <div className="hero-top">
        <div className="hero-eyebrow">Trade Intelligence Network</div>
        <div className="hero-title">India's Building<br /><span>Materials Database</span></div>
        <div className="hero-sub">Community-driven intelligence for the building materials trade. Discover stores, verify data, contribute to grow.</div>
        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">12,847</div><div className="stat-lbl">Stores</div></div>
          <div className="stat-card"><div className="stat-num">3,291</div><div className="stat-lbl">Contributors</div></div>
          <div className="stat-card"><div className="stat-num">284</div><div className="stat-lbl">Cities</div></div>
          <div className="stat-card"><div className="stat-num">17</div><div className="stat-lbl">Categories</div></div>
        </div>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={onExplore}>Explore {selectedCity || "Stores"}</button>
          <button className="btn btn-ghost" onClick={onAdd}>+ Add a Store</button>
        </div>
      </div>
      <div className="city-section">
        <div className="section-hd">Quick Cities</div>
        <div className="city-grid" style={{ marginBottom: 20 }}>
          {topCities.map(c => (
            <div key={c} className={`city-pill ${selectedCity === c ? "sel" : ""}`} onClick={() => onCitySelect(c)}>
              <span className="city-name">{c}</span>
              <span className="city-count">{Math.floor(Math.random() * 400 + 50)}</span>
            </div>
          ))}
        </div>
        <div className="section-hd">All Cities</div>
        <input className="fi" style={{ marginBottom: 12 }} placeholder="Search any city..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="city-grid">
          {filtered.slice(0, 40).map(c => (
            <div key={c} className={`city-pill ${selectedCity === c ? "sel" : ""}`} onClick={() => onCitySelect(c)}>
              <span className="city-name">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategorySelector({ value, onChange }) {
  const [cat, setCat] = useState(value?.category || "");
  const [sub, setSub] = useState(value?.subCategory || "");
  const [prod, setProd] = useState(value?.productType || "");

  const subs = cat ? Object.keys(CATEGORY_TREE[cat] || {}) : [];
  const prods = sub ? (CATEGORY_TREE[cat]?.[sub] || []) : [];

  const select = (level, val) => {
    if (level === "cat") { setCat(val); setSub(""); setProd(""); onChange({ category: val, subCategory: "", productType: "" }); }
    if (level === "sub") { setSub(val); setProd(""); onChange({ category: cat, subCategory: val, productType: "" }); }
    if (level === "prod") { setProd(val); onChange({ category: cat, subCategory: sub, productType: val }); }
  };

  return (
    <div className="cat-selector">
      <div className="cat-row">
        <div className="cat-col">
          <div className="cat-col-hd">Category</div>
          {Object.keys(CATEGORY_TREE).map(c => (
            <div key={c} className={`cat-item ${cat === c ? "on" : ""}`} onClick={() => select("cat", c)}>{c}</div>
          ))}
        </div>
        <div className="cat-col">
          <div className="cat-col-hd">Sub-category</div>
          {subs.length === 0 ? <div style={{ padding: "10px", fontSize: "11px", color: "var(--t3)" }}>Select category first</div> :
            subs.map(s => <div key={s} className={`cat-item ${sub === s ? "on" : ""}`} onClick={() => select("sub", s)}>{s}</div>)}
        </div>
        <div className="cat-col">
          <div className="cat-col-hd">Product Type</div>
          {prods.length === 0 ? <div style={{ padding: "10px", fontSize: "11px", color: "var(--t3)" }}>Select sub-category</div> :
            prods.map(p => <div key={p} className={`cat-item ${prod === p ? "on" : ""}`} onClick={() => select("prod", p)}>{p}</div>)}
        </div>
      </div>
      <div className="cat-selected">
        {cat ? `${cat}${sub ? ` → ${sub}` : ""}${prod ? ` → ${prod}` : ""}` : "No category selected"}
      </div>
    </div>
  );
}

function AddPage({ user, onSubmit, toast }) {
  const isContributor = user.role === "contributor";
  const canContribute = !isContributor || user.validationStatus === "active" || user.validationStatus === "pending";

  const [recType, setRecType] = useState("store");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [locating, setLocating] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    storeName: "", phone: "", address: "", city: "", state: "", pincode: "",
     businessType: "",
    ownerName: "", email: "", personalEmail: "", gst: "", brands: "", whatsapp: "", instagram: "", website: "", lat: null, lng: null,
    linkedIn: "", facebook: "", specialization: "", firmName: "",
  });

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleChk = (item) => setChecklist(c => c.includes(item) ? c.filter(x => x !== item) : [...c, item]);

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
    await new Promise(r => setTimeout(r, 700));
    // TODO: await addDoc(collection(db, "stores"), { ...form, checklist, type: recType, contributorId: user.email, verificationStatus: "community_added", pointsAwarded: 10, createdAt: new Date(), confidence: 20 });
    // TODO: await updateDoc(doc(db, "users", user.uid), { points: increment(10), storesAdded: increment(1) });
    onSubmit({ ...form, categories: selectedCategories, checklist, type: recType, contributorId: user.email, verificationStatus: "community_added", pointsAwarded: 10, createdAt: new Date().toISOString(), confidence: 20, id: Date.now().toString() });
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
              <input className="fi" placeholder="6-digit pincode" value={form.pincode} onChange={e => upd("pincode", e.target.value)} />
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
            {recType === "store" && <div className="field">
              <label className="fl">GST Number</label>
              <input className="fi" placeholder="GSTIN" value={form.gst} onChange={e => upd("gst", e.target.value)} />
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

function DiscoveryPage({ stores, selectedCity }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const cats = ["All", ...Object.keys(CATEGORY_TREE).slice(0, 8)];
  const types = ["All", ...BUSINESS_TYPES];

  const filtered = stores.filter(s => {
    const ms = s.storeName.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase()) || (s.brands || "").toLowerCase().includes(search.toLowerCase());
    const mc = catFilter === "All" || s.category === catFilter;
    const mt = typeFilter === "All" || s.businessType === typeFilter;
    const mst = statusFilter === "All" || s.verificationStatus === statusFilter;
    const mcity = !selectedCity || s.city === selectedCity;
    return ms && mc && mt && mst && mcity;
  });

  return (
    <div className="discovery">
      <div className="disc-sidebar">
        <div className="disc-sidebar-hd">
          <div className="srch">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--t3)", flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input placeholder={`Search${selectedCity ? ` in ${selectedCity}` : ""}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="chips" style={{ marginBottom: 6 }}>
            {["All", "verified", "community_added"].map(s => (
              <div key={s} className={`chip ${statusFilter === s ? "on" : ""}`} onClick={() => setStatusFilter(s)}>
                {s === "All" ? "All" : s === "verified" ? "✓ Verified" : "Community"}
              </div>
            ))}
          </div>
          <div className="chips" style={{ marginBottom: 6 }}>
            {cats.map(c => <div key={c} className={`chip ${catFilter === c ? "on" : ""}`} onClick={() => setCatFilter(c)}>{c}</div>)}
          </div>
          <div className="chips">
            {["All", "Retailer", "Distributor", "Wholesaler", "Contractor"].map(t => (
              <div key={t} className={`chip ${typeFilter === t ? "on" : ""}`} onClick={() => setTypeFilter(t)}>{t}</div>
            ))}
          </div>
        </div>
        <div className="store-list">
          <div style={{ padding: "6px 8px 8px", fontSize: "11px", color: "var(--t3)" }}>{filtered.length} records{selectedCity ? ` in ${selectedCity}` : ""}</div>
          {filtered.map(s => (
            <div key={s.id} className={`sc ${selected?.id === s.id ? "sel" : ""}`} onClick={() => setSelected(s)}>
              <div className="sc-top">
                <div className="sc-name">{s.storeName}</div>
                <div className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>
                  {s.verificationStatus === "verified" ? "✓ Verified" : "Community"}
                </div>
              </div>
              <div className="sc-meta">
                <span>📍 {s.city}</span>
                <span>🏪 {s.businessType}</span>
                <span>📦 {s.category}</span>
              </div>
              {s.brands && <div style={{ fontSize: "11px", color: "var(--t3)", marginTop: 4 }}>{s.brands.substring(0, 40)}{s.brands.length > 40 ? "..." : ""}</div>}
              <ConfidenceBar value={s.confidence} />
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--t3)" }}>No records found</div>}
        </div>
      </div>
      <div className="disc-main">
        {selected ? (
          <div className="detail-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div className="detail-name">{selected.storeName}</div>
              <button className="btn-sm btn-out" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="cat-breadcrumb">
              <span className="cat-node">{selected.category}</span>
              {selected.subCategory && <><span className="cat-sep">›</span><span className="cat-node">{selected.subCategory}</span></>}
              {selected.productType && <><span className="cat-sep">›</span><span className="cat-node last">{selected.productType}</span></>}
            </div>
            <div className="detail-badges">
              <div className={`badge ${selected.verificationStatus === "verified" ? "bv" : "bc"}`}>
                {selected.verificationStatus === "verified" ? "✓ Verified" : "Community Added"}
              </div>
              <div className="badge bp">{selected.businessType}</div>
              {selected.type === "individual" && <div className="badge" style={{ background: "var(--info)15", color: "var(--info)", border: "1px solid var(--info)25" }}>Individual</div>}
            </div>
            <div className="conf-section">
              <div className="conf-hd">
                <span className="conf-title">Data Confidence Score</span>
                <span className="conf-pct" style={{ color: selected.confidence >= 80 ? "var(--ok)" : selected.confidence >= 50 ? "var(--warn)" : "#ef4444" }}>{selected.confidence}%</span>
              </div>
              <ConfidenceBar value={selected.confidence} size="lg" />
              <div className="enrich-row">
                <div className={`enrich-pill ${selected.phone ? "linked" : ""}`}>📞 Phone {selected.phone ? "✓" : "—"}</div>
                <div className={`enrich-pill ${selected.email ? "linked" : ""}`}>📧 Email {selected.email ? "✓" : "—"}</div>
                <div className={`enrich-pill ${selected.gst ? "linked" : ""}`}>🏛 GST {selected.gst ? "✓" : "—"}</div>
                <div className={`enrich-pill`}>LinkedIn —</div>
                <div className={`enrich-pill`}>Facebook —</div>
              </div>
            </div>
            <div className="detail-grid">
              {[
                ["City", selected.city], ["State", selected.state], ["Pincode", selected.pincode],
                ["Phone", selected.phone], ["Owner", selected.ownerName || "—"], ["Email", selected.email || "—"],
                ["GST", selected.gst || "—"], ["Added", selected.createdAt?.substring(0, 10)],
              ].map(([k, v]) => (
                <div key={k} className="dg-item"><div className="dg-label">{k}</div><div className="dg-value">{v || "—"}</div></div>
              ))}
              {selected.address && <div className="dg-item" style={{ gridColumn: "1/-1" }}><div className="dg-label">Address</div><div className="dg-value">{selected.address}</div></div>}
              {selected.brands && <div className="dg-item" style={{ gridColumn: "1/-1" }}><div className="dg-label">Brands Carried</div><div className="dg-value">{selected.brands}</div></div>}
            </div>
            <div className="action-row">
              <button className="btn-sm btn-acc">📞 Call</button>
              <button className="btn-sm btn-ok">✓ Verify Info</button>
              <button className="btn-sm btn-out">✏️ Suggest Edit</button>
              <button className="btn-sm btn-out">⚑ Report</button>
              <button className="btn-sm btn-out">🏷 Claim Business</button>
            </div>
          </div>
        ) : (
          <div className="empty-detail">
            <div style={{ fontSize: 40, opacity: .3 }}>🏪</div>
            <div>Select a store to view details</div>
            {selectedCity && <div style={{ fontSize: "12px" }}>Showing results for {selectedCity}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardPage({ contributors }) {
  const sorted = [...contributors].sort((a, b) => b.points - a.points);
  const total = contributors.reduce((s, c) => s + c.storesAdded, 0);
  const avColors = ["#f59e0b","#9ca3af","#cd7f32","#6366f1","#22c55e","#ec4899"];

  return (
    <div className="lb-pg">
      <div className="lb-wrap">
        <div className="lb-hd">
          <div className="lb-title">Leaderboard</div>
          <div className="lb-sub">Top contributors building India's trade intelligence</div>
        </div>
        <div className="lb-stats">
          <div className="lb-stat"><div className="lb-sv">{contributors.length}</div><div className="lb-sl">Contributors</div></div>
          <div className="lb-stat"><div className="lb-sv">{total}</div><div className="lb-sl">Stores Added</div></div>
          <div className="lb-stat"><div className="lb-sv">{Math.max(...contributors.map(c => c.citiesCovered))}+</div><div className="lb-sl">Cities</div></div>
          <div className="lb-stat"><div className="lb-sv">12.8K</div><div className="lb-sl">Total Records</div></div>
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
                <div className="lb-name">{c.name}</div>
                <div className="lb-meta">{c.storesAdded} stores · {c.citiesCovered} cities · {c.city}</div>
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

function ProfilePage({ user }) {
  const lv = getLevel(user.points);
  const nextLv = CONTRIBUTOR_LEVELS.find(l => l.min > user.points);
  const acts = [
    { text: `Added ${user.storesAdded || 1} store${(user.storesAdded || 1) > 1 ? "s" : ""} recently`, pts: `+${(user.storesAdded || 1) * 10} pts`, time: "Today" },
    { text: "Joined Trade Intelligence Network", pts: "Welcome!", time: "Account created" },
  ];

  return (
    <div className="prof-pg">
      <div className="prof-wrap">
        <div className="prof-hero">
          <div className="prof-top">
            <div className="prof-av">{user.name.charAt(0).toUpperCase()}</div>
            <div>
              <div className="prof-name">{user.name}</div>
              <div className="prof-role">{ROLES.find(r => r.id === user.role)?.label || user.role}</div>
              <div className="prof-lbadge" style={{ background: lv.bg, color: lv.color, border: `1px solid ${lv.color}30` }}>◆ {lv.name} Contributor</div>
            </div>
          </div>
          <div className="prof-grid">
            <div className="prof-stat"><div className="prof-sv" style={{ color: "var(--acc)" }}>{user.points}</div><div className="prof-sl">Points</div></div>
            <div className="prof-stat"><div className="prof-sv">{user.storesAdded}</div><div className="prof-sl">Stores Added</div></div>
            <div className="prof-stat"><div className="prof-sv">{user.citiesCovered}</div><div className="prof-sl">Cities</div></div>
          </div>
        </div>
        <div className="prog-sec">
          <div className="prog-title">Contributor Progress</div>
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

function AdminDashboard({ stores }) {
  const [section, setSection] = useState("dashboard");
  const [uploadType, setUploadType] = useState("stores");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState([]);
  const [dupAction, setDupAction] = useState({});

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map((line, i) => {
      const vals = line.split(",").map(v => v.trim());
      return headers.reduce((obj, h, j) => ({ ...obj, [h]: vals[j] || "" }), { _row: i + 1 });
    });
  };

  const handleCSV = (text) => { setCsvText(text); setPreview(parseCSV(text)); };

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "validation", icon: "✅", label: "Contributor Validation" },
    { id: "upload", icon: "📤", label: "Bulk Upload" },
    { id: "duplicates", icon: "🔗", label: "Duplicate Manager" },
    { id: "enrichment", icon: "✨", label: "Enrichment Queue" },
    { id: "users", icon: "👥", label: "User Management" },
    { id: "records", icon: "🗂", label: "All Records" },
  ];
  const pendingContribs = MOCK_CONTRIBUTORS.filter(c=>c.validationStatus==="pending");

  return (
    <div className="admin-pg">
      <div className="admin-nav">
        <div className="admin-nav-title">Admin Panel</div>
        {navItems.map(n => (
          <div key={n.id} className={`anav ${section === n.id ? "on" : ""}`} onClick={() => setSection(n.id)}>
            <span className="anav-icon">{n.icon}</span>{n.label}
          </div>
        ))}
      </div>
      <div className="admin-main">

        {section === "dashboard" && <>
          <div className="admin-hd">
            <div className="admin-title">Dashboard</div>
            <div className="admin-sub">Platform overview — Trade Intelligence Network</div>
          </div>
          <div className="admin-stats">
            {[["12,847","Total Records","+247 this week"],["3,291","Contributors","+34 this week"],["284","Cities Covered","+8 this week"],["47","Pending Verify","Needs attention"]].map(([v, l, d]) => (
              <div key={l} className="as-card"><div className="as-val">{v}</div><div className="as-lbl">{l}</div><div className="as-delta">{d}</div></div>
            ))}
          </div>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <div className="table-hd"><span className="table-title">Recent Contributions</span><span style={{ fontSize: 12, color: "var(--t3)" }}>Last 24 hours</span></div>
            <table>
              <thead><tr><th>Store / Name</th><th>City</th><th>Category</th><th>Contributor</th><th>Status</th><th>Confidence</th></tr></thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--t1)", fontWeight: 500 }}>{s.storeName}</td>
                    <td>{s.city}</td>
                    <td>{s.category}</td>
                    <td>{s.contributorId}</td>
                    <td><span className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>{s.verificationStatus === "verified" ? "Verified" : "Community"}</span></td>
                    <td><span style={{ color: s.confidence >= 80 ? "var(--ok)" : s.confidence >= 50 ? "var(--warn)" : "#ef4444", fontWeight: 700 }}>{s.confidence}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {section === "validation" && <>
          <div className="admin-hd"><div className="admin-title">Contributor Validation</div><div className="admin-sub">Review and approve industry contributor applications</div></div>
          {pendingContribs.length===0?(
            <div className="val-ok-banner"><span>✓</span><div>No pending validations. All contributors are approved.</div></div>
          ):pendingContribs.map(c=>(
            <div key={c.id} style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--rl)",padding:16,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,var(--info),#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,color:"white"}}>{c.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:16}}>{c.name}</div>
                  <div style={{fontSize:12,color:"#080808"}}>{c.workEmail}</div>
                </div>
                <span className="badge bd">Pending Review</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[["Work Email",c.workEmail],["Personal Email",c.personalEmail],["Company",c.company],["LinkedIn",c.linkedin||"Not provided"]].map(([l,v])=>(
                  <div key={l} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:10}}>
                    <div style={{fontSize:10,color:"#080808",textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-sm btn-ok">✓ Approve</button>
                <button className="btn-sm btn-out">View LinkedIn ↗</button>
                <button className="btn-sm" style={{background:"var(--danger)15",color:"var(--danger)",border:"1px solid var(--danger)25",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>✕ Reject</button>
              </div>
            </div>
          ))}
        </>}

        {section === "upload" && <>
          <div className="admin-hd">
            <div className="admin-title">Bulk Upload</div>
            <div className="admin-sub">Import stores, contractors, or architects from CSV</div>
          </div>
          <div className="tmpl-cards">
            {BULK_TEMPLATES.map(t => (
              <div key={t.id} className={`tmpl-card ${uploadType === t.id ? "sel" : ""}`} style={uploadType === t.id ? { borderColor: "var(--acc)", background: "var(--acc)10" } : {}} onClick={() => { setUploadType(t.id); setCsvText(""); setPreview([]); }}>
                <div className="tmpl-icon">{t.icon}</div>
                <div className="tmpl-name">{t.name}</div>
                <div className="tmpl-desc">{t.desc}</div>
                <div className="tmpl-fields"><strong>Required:</strong> {t.required.join(", ")}<br /><strong>Optional:</strong> {t.optional.slice(0, 4).join(", ")}...</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 600 }}>
              {BULK_TEMPLATES.find(t => t.id === uploadType)?.name} Template
            </div>
            <button className="btn-sm btn-out" onClick={() => {
              const t = BULK_TEMPLATES.find(t => t.id === uploadType);
              const blob = new Blob([t.sample], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `TIN_${t.id}_template.csv`; a.click();
            }}>⬇ Download Template CSV</button>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="fl">Paste CSV Data or edit below</label>
            <textarea className="fta" style={{ minHeight: 160, fontFamily: "monospace", fontSize: 12 }}
              placeholder={`Paste your CSV here...\nMinimum required: ${BULK_TEMPLATES.find(t => t.id === uploadType)?.required.join(", ")}`}
              value={csvText} onChange={e => handleCSV(e.target.value)} />
          </div>
          {preview.length > 0 && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{preview.length} records ready to import</div>
              <button className="btn-sm btn-acc" onClick={() => { alert(`${preview.length} records queued for import.\n\nConnect Firebase to complete.`); }}>
                Import {preview.length} Records →
              </button>
            </div>
            <div className="table-wrap preview-table">
              <table>
                <thead><tr>{Object.keys(preview[0]).filter(k => k !== "_row").map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{preview.slice(0, 5).map(row => (
                  <tr key={row._row}>{Object.keys(row).filter(k => k !== "_row").map(h => <td key={h}>{row[h] || <span style={{ color: "var(--b3)" }}>—</span>}</td>)}</tr>
                ))}</tbody>
              </table>
              {preview.length > 5 && <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--t3)" }}>+{preview.length - 5} more rows</div>}
            </div>
          </>}
        </>}

        {section === "duplicates" && <>
          <div className="admin-hd">
            <div className="admin-title">Duplicate Manager</div>
            <div className="admin-sub">{DUPLICATE_PAIRS.length} potential duplicates detected — review and merge</div>
          </div>
          {DUPLICATE_PAIRS.map(dp => (
            <div key={dp.id} className="dup-pair">
              <div className="dup-reason">⚠ {dp.matchReason}</div>
              <div className="dup-grid">
                {[dp.store1, dp.store2].map((s, si) => (
                  <div key={si} className="dup-card">
                    <div className="dup-card-title">{s.storeName}</div>
                    {[["Phone", "phone"], ["City", "city"], ["Category", "category"], ["Address", "address"]].map(([lbl, key]) => (
                      <div key={key} className="dup-field">
                        <div className="dup-field-lbl">{lbl}</div>
                        <div className={`dup-field-val ${dp.store1[key] !== dp.store2[key] ? "diff" : ""}`}>{s[key] || "—"}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}><span className="badge" style={{ fontSize: 10 }}>Confidence: {s.confidence}%</span></div>
                  </div>
                ))}
                <div className="vs-badge">VS</div>
              </div>
              <div className="dup-actions">
                <button className="btn-sm btn-acc" onClick={() => setDupAction(d => ({ ...d, [dp.id]: "merged" }))}>Merge → Keep Record 1</button>
                <button className="btn-sm btn-out" onClick={() => setDupAction(d => ({ ...d, [dp.id]: "keep2" }))}>Merge → Keep Record 2</button>
                <button className="btn-sm btn-ok" onClick={() => setDupAction(d => ({ ...d, [dp.id]: "notdup" }))}>Not a Duplicate</button>
                {dupAction[dp.id] && <span style={{ fontSize: 12, color: "var(--ok)", padding: "7px 0", fontWeight: 700 }}>✓ {dupAction[dp.id] === "merged" ? "Merged" : dupAction[dp.id] === "keep2" ? "Merged (2)" : "Marked distinct"}</span>}
              </div>
            </div>
          ))}
        </>}

        {section === "enrichment" && <>
          <div className="admin-hd">
            <div className="admin-title">Enrichment Queue</div>
            <div className="admin-sub">Records pending AI and API-based data enrichment</div>
          </div>
          <div style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Enrichment Roadmap</div>
            {[
              { phase: "Phase 1 — Live", label: "Truecaller API", desc: "Name + city from mobile number", status: "ready", icon: "📞" },
              { phase: "Phase 2 — Planned", label: "LinkedIn via Proxycurl", desc: "Profile from name + company", status: "planned", icon: "💼" },
              { phase: "Phase 2 — Planned", label: "Google Places API", desc: "Address, hours, category from name + city", status: "planned", icon: "🗺" },
              { phase: "Phase 3 — Future", label: "AI Profile Matching", desc: "LLM-based enrichment with confidence score", status: "future", icon: "🤖" },
              { phase: "Phase 3 — Future", label: "WhatsApp OTP Verification", desc: "Self-verification by business owner", status: "future", icon: "✅" },
            ].map(e => (
              <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--b1)" }}>
                <div style={{ fontSize: 20, width: 30 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{e.phase} · {e.desc}</div>
                </div>
                <span className={`badge ${e.status === "ready" ? "bv" : e.status === "planned" ? "bp" : "bc"}`}>
                  {e.status === "ready" ? "Ready" : e.status === "planned" ? "Planned" : "Future"}
                </span>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <div className="table-hd"><span className="table-title">Records Pending Enrichment</span></div>
            <table>
              <thead><tr><th>Name</th><th>City</th><th>Phone</th><th>Missing Data</th><th>Action</th></tr></thead>
              <tbody>
                {stores.filter(s => !s.email || !s.gst || s.confidence < 60).map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--t1)", fontWeight: 500 }}>{s.storeName}</td>
                    <td>{s.city}</td>
                    <td>{s.phone}</td>
                    <td style={{ fontSize: 11, color: "var(--warn)" }}>
                      {[!s.email && "Email", !s.gst && "GST", !s.ownerName && "Owner"].filter(Boolean).join(", ")}
                    </td>
                    <td><button className="btn-sm btn-out" style={{ fontSize: 11 }}>Enrich →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {section === "users" && <>
          <div className="admin-hd">
            <div className="admin-title">User Management</div>
            <div className="admin-sub">All registered users and their contribution status</div>
          </div>
          <div className="table-wrap">
            <div className="table-hd"><span className="table-title">Contributors</span></div>
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>City</th><th>Points</th><th>Stores</th><th>Level</th></tr></thead>
              <tbody>
                {MOCK_CONTRIBUTORS.map(c => {
                  const lv = getLevel(c.points);
                  return (
                    <tr key={c.id}>
                      <td style={{ color: "var(--t1)", fontWeight: 600 }}>{c.name}</td>
                      <td>{c.email}</td>
                      <td><span className="badge bp">{c.role}</span></td>
                      <td>{c.city}</td>
                      <td style={{ color: "var(--acc)", fontWeight: 700 }}>{c.points}</td>
                      <td>{c.storesAdded}</td>
                      <td style={{ color: lv.color, fontWeight: 700 }}>{lv.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}

        {section === "records" && <>
          <div className="admin-hd">
            <div className="admin-title">All Records</div>
            <div className="admin-sub">Complete database — stores, individuals, and professionals</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>City</th><th>Category</th><th>Business Type</th><th>Status</th><th>Confidence</th></tr></thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--t1)", fontWeight: 600 }}>{s.storeName}</td>
                    <td><span className="badge bp">{s.type === "individual" ? "Individual" : "Store"}</span></td>
                    <td>{s.city}</td>
                    <td>{s.category}</td>
                    <td>{s.businessType}</td>
                    <td><span className={`badge ${s.verificationStatus === "verified" ? "bv" : "bc"}`}>{s.verificationStatus === "verified" ? "Verified" : "Community"}</span></td>
                    <td><span style={{ color: s.confidence >= 80 ? "var(--ok)" : s.confidence >= 50 ? "var(--warn)" : "#ef4444", fontWeight: 700 }}>{s.confidence}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [stores, setStores] = useState(MOCK_STORES);
  const [contributors, setContributors] = useState(MOCK_CONTRIBUTORS);

  // Load real stores from Firestore on mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const snap = await getDocs(collection(db, "stores"));
        if (!snap.empty) {
          const firestoreStores = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString() }));
          setStores([...MOCK_STORES, ...firestoreStores]);
        }
      } catch(e) { console.log("Using mock stores:", e.message); }
    };
    loadStores();
  }, []);
  const [selectedCity, setSelectedCity] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: "", type: "ok" });

  const [authLoading, setAuthLoading] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);

  // Persistent login — check auth state on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser({ ...profile, uid: firebaseUser.uid });
            setPage(profile.role === "admin" ? "admin" : "home");
          }
        } catch(e) { console.log("Profile load error:", e); }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setPage("home");
  };

  const showToast = (msg, type = "ok") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const handleCitySelect = (city) => { setSelectedCity(city); };
  const handleExplore = () => setPage("discover");
  const handleAddStore = () => setPage("add");
  const handleMessageAdmin = () => { showToast("Message sent to admin! We will contact you within 24 hours.", "ok"); };

  const handleSubmitStore = (data) => {
    setStores(s => [data, ...s]);
    setUser(u => ({ ...u, points: (u.points || 0) + 10, storesAdded: (u.storesAdded || 0) + 1 }));
    showToast("Store added! +10 points earned 🏆");
    setPage("discover");
  };

  const isContrib = user?.role === "contributor";
  const isRetailer = user?.role === "retailer";
  const showLeaderboard = isContrib;
  const TABS = user?.role === "admin"
    ? [["admin","Admin Panel"]]
    : isRetailer
    ? [] // Retailer uses internal sidebar nav
    : [
        ["home","Home"],
        ["discover","Discover"],
        ["add","+ Add"],
        ...(isContrib ? [["rewards","My Rewards"]] : []),
        ["staff","Staff Profile"],
        ...(showLeaderboard ? [["leaderboard","Leaderboard"]] : []),
        ["deals","Deals"],
        ["profile","Profile"],
      ];

  // Check if accessing admin panel via URL hash
  const isAdminRoute = typeof window !== "undefined" && window.location.hash === "#admin";
  const [showAdminLogin, setShowAdminLogin] = useState(isAdminRoute);

  if (authLoading) return <><style>{G}</style><div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f4f5f7",flexDirection:"column",gap:12}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:28,color:"var(--acc)"}}>TIN</div><div style={{fontSize:13,color:"#080808"}}>Loading...</div></div></>;
  if (!user && showAdminLogin) return <><style>{G}</style><div className={"light"} style={{background:"#f4f5f7",minHeight:"100vh"}}><AdminLoginPage onAdminLogin={(u) => { setUser(u); setPage("admin"); setShowAdminLogin(false); }} /></div></>;
  if (!user) return <><style>{G}</style><div className={"light"} style={{background:"#f4f5f7",minHeight:"100vh"}}><LoginPage onLogin={(u) => { setUser(u); setPage(u.role === "admin" ? "admin" : "home"); }} /></div></>;

  return (
    <>
      <style>{G}</style>
      <div className="app light" style={{background:"#f4f5f7",color:"#080808",minHeight:"100vh"}}>
        <nav className="topbar">
          <div className="logo">T<em>I</em>N</div>
          {!isRetailer && <div className="nav-tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={`ntab ${page === id ? "on" : ""}`} onClick={() => setPage(id)}>{label}</button>
            ))}
          </div>
          <div className="topbar-right">
            {selectedCity && <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>📍 {selectedCity}</div>}
            {user.role !== "admin" && <div className="pts-badge">{user.points || 0} pts</div>}

            <div className="avatar" onClick={() => setPage("profile")}>{user.name.charAt(0).toUpperCase()}</div>
            <button onClick={handleLogout} style={{padding:"4px 10px",borderRadius:8,background:"transparent",border:"1px solid var(--b3)",color:"#080808",fontSize:12,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}} title="Logout">↩ Out</button>
          </div>
        </nav>
        {showThankYou && (
          <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--rxl)",padding:36,maxWidth:380,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>🎉</div>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:24,marginBottom:8}}>Thank You!</div>
              <div style={{fontSize:14,color:"#080808",marginBottom:16,lineHeight:1.6}}>Your store profile has been submitted successfully. You earned <strong style={{color:"var(--acc)"}}>+10 points</strong> for contributing to TIN!</div>
              <div style={{fontSize:12,color:"#080808"}}>Redirecting to home...</div>
            </div>
          </div>
        )}
        <div className="page">
          {page === "home" && (isRetailer
            ? <RetailerDashboard user={user} stores={stores} onNavigate={setPage} />
            : <HeroPage onCitySelect={handleCitySelect} selectedCity={selectedCity} onExplore={handleExplore} onAdd={handleAddStore} />
          )}
          {page === "discover" && <DiscoveryPage stores={stores} selectedCity={selectedCity} />}
          {page === "add" && <AddPage user={user} onSubmit={handleSubmitStore} toast={showToast} />}
          {page === "rewards" && <RewardsPage user={user} onMessageAdmin={handleMessageAdmin} />}
          {page === "staff" && <StaffProfilePage user={user} />}
          {page === "leaderboard" && <LeaderboardPage contributors={contributors} />}
          {page === "deals" && <DealsPage />}
          {page === "profile" && <ProfilePage user={user} />}
          {page === "admin" && <AdminDashboard stores={stores} />}
        </div>
        <Toast {...toast} />
      </div>
    </>
  );
}
