// Find candidates (A1): the search fields kept on jobProfiles/{uid}. City and
// experience are typed freely, so they are also stored in a form the database
// can filter on. Plain functions, zero React/Firebase imports — unit-tested.

// The four "looking" visibilities. Keep in sync with searchFieldsOk() in
// firestore.rules.
export const LOOKING = ["actively_looking", "open_to_opportunities", "freelance_project", "employed_open_suitable"];

// On employer search = the person said yes AND is looking. The rules refuse a
// save where `searchable` says anything else.
export const isSearchable = (p) => p?.openToEmployers === true && LOOKING.includes(p?.visibility);

export const EXP_BANDS = [
  { key: "0_1", label: "0–1 years" },
  { key: "2_4", label: "2–4 years" },
  { key: "5_9", label: "5–9 years" },
  { key: "10_plus", label: "10+ years" },
];

// years: a number, or null / "" when not given (→ "": not in any band).
export function expBand(years) {
  if (years == null || years === "") return "";
  const n = Number(years);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 2) return "0_1";
  if (n < 5) return "2_4";
  if (n < 10) return "5_9";
  return "10_plus";
}

// Other names and Hindi spellings → one key per city.
const CITY_NAMES = {
  mumbai: ["bombay", "मुंबई", "मुम्बई", "बंबई"],
  "navi mumbai": ["new mumbai", "नवी मुंबई", "नवी मुम्बई"],
  thane: ["thana", "ठाणे", "थाने"],
  pune: ["poona", "पुणे", "पूना"],
  nagpur: ["नागपुर", "नागपूर"],
  nashik: ["nasik", "नासिक", "नाशिक"],
  delhi: ["new delhi", "दिल्ली", "नई दिल्ली"],
  noida: ["नोएडा"],
  gurugram: ["gurgaon", "गुरुग्राम", "गुड़गांव", "गुड़गाँव"],
  ghaziabad: ["गाज़ियाबाद", "गाजियाबाद"],
  faridabad: ["फरीदाबाद", "फ़रीदाबाद"],
  bengaluru: ["bangalore", "banglore", "बेंगलुरु", "बंगलौर"],
  hyderabad: ["हैदराबाद"],
  secunderabad: ["सिकंदराबाद"],
  chennai: ["madras", "चेन्नई"],
  kolkata: ["calcutta", "कोलकाता"],
  ahmedabad: ["ahmadabad", "अहमदाबाद"],
  surat: ["सूरत"],
  vadodara: ["baroda", "वडोदरा"],
  jaipur: ["जयपुर"],
  lucknow: ["लखनऊ"],
  kanpur: ["कानपुर"],
  indore: ["इंदौर"],
  bhopal: ["भोपाल"],
  patna: ["पटना"],
  kochi: ["cochin"],
  kozhikode: ["calicut"],
  thiruvananthapuram: ["trivandrum"],
  visakhapatnam: ["vizag"],
  mysuru: ["mysore"],
  mangaluru: ["mangalore"],
  prayagraj: ["allahabad", "प्रयागराज", "इलाहाबाद"],
  varanasi: ["banaras", "benares", "वाराणसी", "बनारस"],
};

// Same text clean-up for what's typed and for the list above. NFKD + NFC makes
// the two ways of typing ड़ / ज़ the same; marks (\p{M}) must stay for Hindi.
const clean = (raw) => String(raw ?? "").normalize("NFKD").normalize("NFC").toLowerCase()
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

const ALIAS = new Map(Object.entries(CITY_NAMES).flatMap(([key, names]) => names.map(n => [clean(n), key])));

// "Thane (W)", "thane west, Maharashtra" and "ठाणे" → "thane". A pincode or
// anything after a comma is ignored.
export function cityKey(raw) {
  let c = clean(String(raw ?? "").split(/[,/(\n]/)[0]).replace(/\b\d{6}\b/g, " ").replace(/\s+/g, " ").trim();
  c = ALIAS.get(c) || c;
  c = c.replace(/ (west|east|north|south|w|e)$/, "").replace(/ (city|district)$/, "");
  return (ALIAS.get(c) || c).slice(0, 80);
}

// The fields to store, from the shareable profile doc.
export const searchFields = (pub) => ({ cityKey: cityKey(pub?.city), expBand: expBand(pub?.experienceYears) });

// ── Find candidates (A3) ─────────────────────────────────────
export const EMPTY_CANDIDATE_FILTERS = { lane: "", trade: "", fn: "", city: "", exp: "", avail: "" };

// Filters → Firestore conditions [field, op, value]. `searchable` is always
// there: the rules refuse any wider list. A query can hold one array-contains:
// a trade (skilled) or a function (professional), never both.
export function candidateFilters(f = {}) {
  const out = [["searchable", "==", true]];
  if (f.lane) out.push(["lane", "==", f.lane]);
  if (f.trade && f.lane === "skilled") out.push(["trades", "array-contains", f.trade]);
  if (f.fn && f.lane === "professional") out.push(["functions", "array-contains", f.fn]);
  const city = cityKey(f.city);
  if (city) out.push(["cityKey", "==", city]);
  if (f.exp) out.push(["expBand", "==", f.exp]);
  if (f.avail) out.push(["availability", "==", f.avail]);
  return out;
}

// What an employer sees of a person on search: the same card as an applicant
// before shortlist (applicationSnapshot), from the shareable profile only.
const SNAPSHOT_KEYS = ["lane", "role", "trades", "functions", "experienceYears", "education", "educationText", "skills", "history", "projects", "city", "areas", "languages", "availability"];
export const candidateSnapshot = (p) => Object.fromEntries(SNAPSHOT_KEYS.filter(k => p?.[k] !== undefined).map(k => [k, p[k]]));
