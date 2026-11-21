// L2b "Find your business" — pure helpers (unit-tested in test/unit/storeClaim.test.js).
// Firestore reads/writes live in src/lib/storeClaims.js; the rules that guard
// them are under match /claims and match /stores in firestore.rules.

// Store names and cities were imported with mixed case ("surat", "BHANDARA",
// "Mumbai"). Firestore has no case-insensitive search, so a search runs one
// prefix query per spelling variant.
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-./&(])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());

export function spellingVariants(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  if (!s) return [];
  return [...new Set([s, titleCase(s), s.toUpperCase(), s.toLowerCase()])];
}

// Common alternate city names in the data.
const CITY_ALIASES = [
  ["Bengaluru", "Bangalore"],
  ["Gurugram", "Gurgaon"],
  ["Mumbai", "Bombay"],
  ["Kochi", "Cochin"],
  ["Kozhikode", "Calicut"],
  ["Thiruvananthapuram", "Trivandrum"],
];

// At most 30 values (Firestore "in" limit).
export function cityVariants(raw) {
  const base = spellingVariants(raw);
  if (!base.length) return [];
  const key = base[0].toLowerCase();
  const alias = CITY_ALIASES.find(pair => pair.some(c => c.toLowerCase() === key));
  const all = alias ? alias.flatMap(spellingVariants) : base;
  return [...new Set([...base, ...all])].slice(0, 30);
}

// Name prefix variants (search matches the START of the business name).
export const nameVariants = (raw) => spellingVariants(raw).slice(0, 4);

export const normalisePhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return ten;
};
export const isValidIndianMobile = (raw) => /^[6-9]\d{9}$/.test(normalisePhone(raw));

// GSTIN: 2-digit state code, 10-char PAN, entity digit, Z, check char.
export const isValidGstin = (raw) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(raw || "").trim().toUpperCase());

// Returns a list of { field, message } (empty when valid).
// Phone is required and must be confirmed; GST is optional (many small shops have none).
export function validateClaim({ name, phone, phoneConfirmed, gst }) {
  const errors = [];
  if (!String(name || "").trim()) errors.push({ field: "name", message: "Enter your name." });
  if (!isValidIndianMobile(phone)) errors.push({ field: "phone", message: "Enter a 10-digit mobile number." });
  if (!phoneConfirmed) errors.push({ field: "phoneConfirmed", message: "Confirm this is your number." });
  if (String(gst || "").trim() && !isValidGstin(gst)) errors.push({ field: "gst", message: "That GST number doesn't look right (15 characters, e.g. 27ABCDE1234F1Z5). Leave it empty if you don't have one." });
  return errors;
}

// The claims/{id} document a claimant creates (shape enforced by firestore.rules).
export function buildClaimDoc(user, store, { name, phone, gst, email }) {
  const gstClean = String(gst || "").trim().toUpperCase();
  return {
    claimantUid: user.uid,
    storeId: store.id,
    storeName: store.storeName || "",
    storeCity: store.city || "",
    name: String(name || "").trim(),
    phone: normalisePhone(phone),
    phoneConfirmed: true,
    gst: gstClean || null,
    email: String(email || user.email || "").trim() || null,
    status: "pending",
  };
}

// Merge the result lists of several prefix queries: unique by id, sorted by name.
export function mergeSearchResults(lists, max = 20) {
  const byId = new Map();
  lists.flat().forEach(s => { if (s && !byId.has(s.id)) byId.set(s.id, s); });
  return [...byId.values()]
    .sort((a, b) => String(a.storeName || "").localeCompare(String(b.storeName || ""), "en", { sensitivity: "base" }))
    .slice(0, max);
}
