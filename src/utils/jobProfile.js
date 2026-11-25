// Candidate job profile (docs/JOBS_BLUEPRINT.md §4): one per TIN account,
// split into a shareable doc (jobProfiles/{uid}) and a private doc
// (jobProfilesPrivate/{uid}: phone, email, pay, CV). Plain functions, zero
// React/Firebase imports — unit-tested.
import {
  AVAIL, EDU, FUNCS, LANES, TRADES, TYPES, VISIBILITY, isKey, labelOf, workTypesForLane,
} from "../data/jobsTaxonomy.js";
import { isSyntheticPhoneEmail } from "./phoneAuth.js";
import { isSearchable, searchFields } from "./candidateSearch.js";

// Fields that must NEVER be on the shareable doc (rules enforce it too).
export const PRIVATE_FIELDS = ["phone", "email", "currentPay", "expectedPay", "cv", "showPayToEmployers"];
export const DEFAULT_VISIBILITY = "open_to_opportunities"; // owner decision, Phase 4

const s = (v) => (typeof v === "string" ? v.trim() : "");
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n >= 0 ? n : null; };
const keys = (arr, list) => [...new Set((Array.isArray(arr) ? arr : []).filter(k => isKey(list, k)))];
const csv = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map(x => String(x).trim()).filter(Boolean);

// The editable profile the UI works with (public + private merged).
export function emptyProfile(user = {}) {
  return {
    // Phone-number accounts have an internal made-up email — never prefill it.
    name: s(user.name), phone: s(user.phone), email: s(user.email && !isSyntheticPhoneEmail(user.email) ? user.email : ""),
    lane: "", role: "", functions: [], trades: [], experienceYears: "",
    education: "", educationText: "", languages: "", skills: "", history: [], projects: "",
    city: s(user.city), areas: "",
    workTypePrefs: [], expectedPay: "", currentPay: "",
    // L8: expected/current pay go to employers only when this is on (default off).
    showPayToEmployers: false,
    availability: "", visibility: DEFAULT_VISIBILITY,
    // A1 "Let employers find and call me": null = not asked yet, never assumed.
    openToEmployers: null,
    cv: null,
  };
}

// Merge the two Firestore docs into the editable shape.
export function profileFromDocs(pub, priv, user = {}) {
  const base = emptyProfile(user);
  if (!pub && !priv) return { ...base, exists: false };
  const p = pub || {}, q = priv || {};
  return {
    ...base,
    exists: !!pub,
    name: s(p.name) || base.name,
    lane: isKey(LANES, p.lane) ? p.lane : "",
    role: s(p.role),
    functions: keys(p.functions, FUNCS),
    trades: keys(p.trades, TRADES),
    experienceYears: p.experienceYears != null ? String(p.experienceYears) : "",
    education: isKey(EDU, p.education) ? p.education : "",
    educationText: s(p.educationText),
    languages: s(p.languages),
    skills: (p.skills || []).join(", "),
    history: Array.isArray(p.history) ? p.history.map(h => ({ role: s(h.role), org: s(h.org), years: s(h.years) })) : [],
    projects: s(p.projects),
    city: s(p.city) || base.city,
    areas: s(p.areas),
    workTypePrefs: keys(p.workTypePrefs, TYPES),
    availability: isKey(AVAIL, p.availability) ? p.availability : "",
    visibility: isKey(VISIBILITY, p.visibility) ? p.visibility : DEFAULT_VISIBILITY,
    openToEmployers: typeof p.openToEmployers === "boolean" ? p.openToEmployers : null,
    // What the database has now, so a save records the time only on a change.
    openToEmployersSaved: typeof p.openToEmployers === "boolean" ? p.openToEmployers : null,
    phone: s(q.phone) || base.phone,
    email: s(q.email) || base.email,
    expectedPay: s(q.expectedPay),
    currentPay: s(q.currentPay),
    showPayToEmployers: q.showPayToEmployers === true,
    cv: q.cv && q.cv.path ? q.cv : null,
  };
}

// Split the editable profile into the two docs to save.
export function splitProfile(pr) {
  const pub = {
    name: s(pr.name),
    lane: isKey(LANES, pr.lane) ? pr.lane : "professional",
    role: s(pr.role),
    functions: keys(pr.functions, FUNCS),
    trades: keys(pr.trades, TRADES),
    experienceYears: num(pr.experienceYears),
    education: isKey(EDU, pr.education) ? pr.education : "",
    educationText: s(pr.educationText),
    languages: s(pr.languages),
    skills: csv(pr.skills).slice(0, 30),
    history: (pr.history || []).map(h => ({ role: s(h.role), org: s(h.org), years: s(h.years) })).filter(h => h.role || h.org).slice(0, 10),
    projects: s(pr.projects),
    city: s(pr.city),
    areas: s(pr.areas),
    workTypePrefs: keys(pr.workTypePrefs, TYPES),
    availability: isKey(AVAIL, pr.availability) ? pr.availability : "",
    visibility: isKey(VISIBILITY, pr.visibility) ? pr.visibility : DEFAULT_VISIBILITY,
    ...(typeof pr.openToEmployers === "boolean" ? { openToEmployers: pr.openToEmployers } : {}),
  };
  Object.assign(pub, searchFields(pub), { searchable: isSearchable(pub) });
  const priv = {
    phone: s(pr.phone),
    email: s(pr.email),
    expectedPay: s(pr.expectedPay),
    currentPay: s(pr.currentPay),
    showPayToEmployers: pr.showPayToEmployers === true,
  };
  if (pr.cv && pr.cv.path) priv.cv = pr.cv;
  return { pub, priv };
}

// The minimum to apply (owner decision): name, mobile, trade/role, city.
export function missingForApply(pr, lane = pr?.lane) {
  const miss = [];
  if (!s(pr?.name)) miss.push("name");
  if (s(pr?.phone).replace(/\D/g, "").length < 10) miss.push("phone");
  if (lane === "skilled" ? !(pr?.trades || []).length : !s(pr?.role)) miss.push(lane === "skilled" ? "trades" : "role");
  if (!s(pr?.city)) miss.push("city");
  return miss;
}
export const isApplyReady = (pr, lane) => missingForApply(pr, lane).length === 0;

// What an application copies for THAT job's employer. Contact details and
// expected pay are copied; current pay NEVER is.
// L8: what the employer can read straight away (the application doc) — no
// phone, email or CV (those go to applicationContact(), unlocked at
// Shortlisted), and pay only if the candidate chose to show it.
export function applicationSnapshot(pr) {
  const { pub, priv } = splitProfile(pr);
  const showPay = priv.showPayToEmployers === true;
  return {
    applicantName: pub.name,
    payVisible: showPay,
    ...(showPay && priv.expectedPay ? { expectedPay: priv.expectedPay } : {}),
    ...(showPay && priv.currentPay ? { currentPay: priv.currentPay } : {}),
    profileSnapshot: {
      lane: pub.lane, role: pub.role, trades: pub.trades, functions: pub.functions,
      experienceYears: pub.experienceYears, education: pub.education, educationText: pub.educationText,
      skills: pub.skills, history: pub.history, projects: pub.projects,
      city: pub.city, areas: pub.areas, languages: pub.languages, availability: pub.availability,
    },
  };
}

// Plain-language lines for the "TIN Profile" card (shown where there's no
// CV — never as a negative). Works on a profileSnapshot.
// L8: the private part of an application (jobApplications/{id}/private/contact).
export function applicationContact(pr) {
  const { priv } = splitProfile(pr);
  return { applicantPhone: priv.phone, applicantEmail: priv.email };
}

export function tinProfileLines(snap = {}) {
  const trades = (snap.trades || []).map(k => {
    const t = TRADES.find(x => x.key === k);
    return t ? `${t.label} (${t.labelHi})` : null;
  }).filter(Boolean);
  const lines = [];
  if (trades.length) lines.push(["Trades", trades.join(", ")]);
  if (snap.role) lines.push(["Role", snap.role]);
  if ((snap.functions || []).length) lines.push(["Function", snap.functions.map(k => labelOf(FUNCS, k)).filter(Boolean).join(", ")]);
  if (snap.experienceYears != null && snap.experienceYears !== "") lines.push(["Experience", `${snap.experienceYears} ${Number(snap.experienceYears) === 1 ? "year" : "years"}`]);
  if ((snap.skills || []).length) lines.push(["Skills", snap.skills.join(", ")]);
  if (snap.projects) lines.push(["Work done", snap.projects]);
  if ((snap.history || []).length) lines.push(["Work history", snap.history.map(h => [h.role, h.org, h.years].filter(Boolean).join(" · ")).join("; ")]);
  const edu = snap.educationText || labelOf(EDU, snap.education);
  if (edu) lines.push(["Education", edu]);
  if (snap.city) lines.push(["City", [snap.city, snap.areas].filter(Boolean).join(" · works in: ")]);
  if (snap.languages) lines.push(["Languages", snap.languages]);
  if (snap.availability) lines.push(["Available", labelOf(AVAIL, snap.availability)]);
  return lines;
}

// ── AI profile helper (docs/JOBS_BLUEPRINT.md §8) ─────────────
// Put the server's draft into the editable profile. Only fields the draft
// actually filled are changed; each one is returned in `suggested` so the
// wizard can mark it "suggested" until the candidate edits it. Nothing is
// saved here: the candidate still presses Save.
//
// Only fields that the lane's wizard SHOWS are filled (JobProfilePage), so
// the candidate sees and can change everything the AI put in before saving.
// Anything else in the draft (e.g. skills for a skilled worker) is ignored.
const DRAFT_FIELDS_COMMON = ["city", "areas", "experienceYears", "languages", "workTypePrefs", "availability"];
export const DRAFT_FIELDS_BY_LANE = {
  skilled: [...DRAFT_FIELDS_COMMON, "trades", "projects"],
  professional: [...DRAFT_FIELDS_COMMON, "role", "functions", "skills", "education", "educationText", "history"],
};

export function applyDraft(pr, draft) {
  const d = draft && typeof draft === "object" ? draft : {};
  const next = { ...pr };
  const suggested = [];
  const set = (k, v) => { next[k] = v; suggested.push(k); };
  if (!isKey(LANES, pr?.lane) && isKey(LANES, d.lane)) set("lane", d.lane);
  const lane = next.lane;
  const shown = new Set(DRAFT_FIELDS_BY_LANE[lane] || DRAFT_FIELDS_COMMON);
  const put = (k, v, ok) => { if (shown.has(k) && ok) set(k, v); };

  for (const k of ["role", "projects", "city", "areas", "languages", "educationText"]) put(k, s(d[k]), !!s(d[k]));
  const trades = keys(d.trades, TRADES); put("trades", trades, trades.length > 0);
  const funcs = keys(d.functions, FUNCS); put("functions", funcs, funcs.length > 0);
  // Only work types the lane's picker offers (skilled: the short list).
  const types = keys(d.workTypePrefs, isKey(LANES, lane) ? workTypesForLane(lane) : TYPES); put("workTypePrefs", types, types.length > 0);
  const yrs = typeof d.experienceYears === "number" && Number.isFinite(d.experienceYears) && d.experienceYears >= 0 && d.experienceYears <= 60 ? d.experienceYears : null;
  put("experienceYears", String(yrs), yrs != null);
  const skills = (Array.isArray(d.skills) ? d.skills : []).map(s).filter(Boolean);
  put("skills", skills.join(", "), skills.length > 0);
  const history = (Array.isArray(d.history) ? d.history : []).filter(h => h && typeof h === "object")
    .map(h => ({ role: s(h.role), org: s(h.org), years: s(h.years) })).filter(h => h.role || h.org);
  put("history", history, history.length > 0);
  put("education", d.education, isKey(EDU, d.education));
  put("availability", d.availability, isKey(AVAIL, d.availability));
  return { next, suggested };
}
