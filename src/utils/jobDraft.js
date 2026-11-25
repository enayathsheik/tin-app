// Post-a-job wizard data: the draft the 5 steps edit, step validation, and
// the Firestore document a draft turns into. Plain functions, zero
// React/Firebase imports, so the whole save shape is unit-tested.
//
// Saving rules (docs/JOBS_BLUEPRINT.md §3):
//  - new-shape fields (lane, functions, workTypes, pay, …) are the truth;
//  - the old fields are written too so older readers keep working:
//    category = first function's label, jobType = first work type's label,
//    salaryRange = the same pay text the job page shows;
//  - "Negotiable" / "Don't disclose" saves NO amounts (only the period):
//    job documents are publicly readable, so hidden numbers must never be
//    stored on them (owner decision, Phase 3);
//  - storeId only when the account has an admin-set store link.
import {
  BENEFITS, FUNCS, INDUSTRIES, LANES, PAY_PERIODS, SHORT_TYPES, TRADES, TYPES, URGENCY,
  industryPrefill, isKey, labelOf,
} from "../data/jobsTaxonomy.js";
import { formatPay, normaliseJob } from "./jobModel.js";

export const WIZARD_STEPS = ["Business", "The job", "Pay", "Why work with you", "Review"];
export const HIDDEN_PAY = ["negotiable", "undisclosed"];

const s = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (text) => s(text).split("\n").map(l => l.trim()).filter(Boolean);
const csv = (text) => s(text).split(",").map(x => x.trim()).filter(Boolean);
const toNum = (v) => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const n = parseFloat(String(v ?? "").replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ── Draft ────────────────────────────────────────────────────

// A blank draft for a new job, prefilled from what the account already has:
// the linked store (admin-set user.storeId), else the business details the
// poster saved last time (user.jobBusiness), else company / storeName.
export function emptyDraft(user = {}, store = null) {
  const remembered = user.jobBusiness || {};
  const business = store
    ? { name: s(store.storeName), industry: industryPrefill({ businessType: store.businessType, role: user.role }) || "", city: s(store.city) }
    : {
        name: s(remembered.name) || s(user.company) || s(user.storeName),
        industry: isKey(INDUSTRIES, remembered.industry) ? remembered.industry : (industryPrefill({ role: user.role }) || ""),
        city: s(remembered.city) || s(user.city),
      };
  return {
    business,
    lane: "professional",
    title: "",
    trade: "",
    headcount: "1",
    functions: [],
    workTypes: [],
    city: business.city,
    state: "",
    pincode: "",
    experience: "",
    workingHours: "",
    education: "",
    duties: "",
    skills: "",
    shortAssignment: { duration: "", startDate: "", urgency: "", certTools: "" },
    // L7: pay range is required (period + from/to); "Negotiable" is a tick shown next to it.
    pay: { period: "month", min: "", max: "", display: "show_range", negotiable: false, incentives: "" },
    evpMode: "list",
    benefits: {},
    evpText: "",
    contactPhone: s(user.phone),
    notAgencyDeclaration: false,
    legacySalaryText: "",
  };
}

// A draft for editing an existing job (old or new shape), via normaliseJob.
export function draftFromJob(raw, user = {}) {
  const j = normaliseJob(raw);
  const base = emptyDraft(user, null);
  const pay = j.pay;
  const structured = pay?.source === "structured";
  return {
    ...base,
    business: { name: j.businessName, industry: j.industry || base.business.industry, city: base.business.city },
    lane: j.lane,
    title: j.title,
    trade: j.trade || "",
    headcount: j.headcount ? String(j.headcount) : "1",
    functions: j.functions,
    workTypes: j.workTypes,
    city: j.city,
    state: j.state,
    pincode: j.pincode,
    experience: j.experience || "",
    workingHours: j.workingHours || "",
    education: j.education || "",
    // Old jobs only have a description: offer it as the duties text.
    duties: j.responsibilities.length ? j.responsibilities.join("\n") : j.description,
    skills: j.skills.join(", "),
    shortAssignment: {
      duration: j.shortAssignment?.duration || "",
      startDate: j.shortAssignment?.startDate || "",
      urgency: j.shortAssignment?.urgency || "",
      certTools: j.shortAssignment?.certTools || "",
    },
    pay: {
      period: pay?.period || "month",
      min: pay?.min != null ? String(pay.min) : "",
      max: pay?.max != null ? String(pay.max) : "",
      // L7: no more "Don't disclose" / "Negotiable instead of pay" — an old job
      // edited here must get a range; old "Negotiable" becomes the tick.
      display: "show_range",
      negotiable: (structured && pay.display === "negotiable") || pay?.negotiable === true,
      incentives: pay?.incentives || "",
    },
    evpMode: j.evpText && !Object.keys(j.benefits).length ? "write" : "list",
    benefits: { ...j.benefits },
    evpText: j.evpText || "",
    contactPhone: j.contactPhone || base.contactPhone,
    notAgencyDeclaration: !!raw?.notAgencyDeclaration,
    // Unreadable old salary text (e.g. "35000") is shown as a hint; editing
    // the job needs a real range (L7).
    legacySalaryText: pay?.source === "legacy" && pay.min == null ? (pay.text || "") : "",
  };
}

export const isShortAssignment = (draft) => (draft.workTypes || []).some(t => SHORT_TYPES.includes(t));

// ── Validation ───────────────────────────────────────────────

// Returns a list of { field, message } for one step (0–4). Empty = OK.
export function validateStep(step, d) {
  const errs = [];
  const err = (field, message) => errs.push({ field, message });
  if (step === 0) {
    if (!s(d.business?.name)) err("business.name", "Add your business name.");
    if (!isKey(INDUSTRIES, d.business?.industry)) err("business.industry", "Choose your industry.");
  }
  if (step === 1) {
    if (!isKey(LANES, d.lane)) err("lane", "Choose Professional or Skilled workforce.");
    if (d.lane === "skilled" && !isKey(TRADES, d.trade)) err("trade", "Choose the trade.");
    if (d.lane !== "skilled" && !s(d.title)) err("title", "Add a job title.");
    const hc = Number(d.headcount);
    if (!Number.isInteger(hc) || hc < 1 || hc > 9999) err("headcount", "Number of people must be a whole number, 1 or more.");
    if (!(d.functions || []).some(k => isKey(FUNCS, k))) err("functions", "Pick at least one function.");
    if (!(d.workTypes || []).some(k => isKey(TYPES, k))) err("workTypes", "Pick at least one work type.");
    if (!s(d.city)) err("city", "Add the city.");
    if (d.pincode && !/^\d{6}$/.test(s(d.pincode))) err("pincode", "Pincode must be 6 digits.");
    if (!lines(d.duties).length) err("duties", "Add at least one line about what they'll do.");
    if (isShortAssignment(d)) {
      if (!s(d.shortAssignment?.duration)) err("shortAssignment.duration", "Add how long the assignment lasts.");
      if (d.shortAssignment?.urgency && !isKey(URGENCY, d.shortAssignment.urgency)) err("shortAssignment.urgency", "Choose how urgent it is.");
    }
  }
  if (step === 2) {
    const p = d.pay || {};
    if (!isKey(PAY_PERIODS, p.period)) err("pay.period", "Choose how it's paid.");
    // L7: a pay range is required on every new or edited job.
    const min = toNum(p.min), max = toNum(p.max);
    if (min == null) err("pay.min", "Add the starting pay (From).");
    if (max == null) err("pay.max", "Add the top of the range (To). Same as From is fine.");
    else if (min != null && max < min) err("pay.max", "\"To\" can't be less than \"From\".");
  }
  if (step === 4) {
    if (!s(d.contactPhone)) err("contactPhone", "Add a contact phone number.");
    if (!d.notAgencyDeclaration) err("notAgencyDeclaration", "Please confirm this is a direct hiring listing.");
  }
  return errs;
}

export const validateAll = (d) => [0, 1, 2, 3, 4].flatMap(i => validateStep(i, d));

// ── Draft → Firestore fields ─────────────────────────────────

// The job content fields to save (no postedBy*, status, timestamps — the
// page adds those for create, and they never change on edit).
// `storeId` = the account's admin-set store link, or null.
export function buildJobFields(d, { storeId = null } = {}) {
  const isSkilled = d.lane === "skilled";
  const tradeLabel = isSkilled ? labelOf(TRADES, d.trade) : null;
  const functions = [...new Set((d.functions || []).filter(k => isKey(FUNCS, k)))];
  const workTypes = [...new Set((d.workTypes || []).filter(k => isKey(TYPES, k)))];
  const short = workTypes.some(t => SHORT_TYPES.includes(t));

  // L7: always a shown range; max is kept even when equal to min (rules
  // require both), and "Negotiable" is a flag shown next to the range.
  const min = toNum(d.pay?.min);
  let max = toNum(d.pay?.max);
  if (max == null || (min != null && max < min)) max = min;
  const pay = {
    period: isKey(PAY_PERIODS, d.pay?.period) ? d.pay.period : "month",
    min,
    max,
    display: "show_range",
    negotiable: d.pay?.negotiable === true,
    incentives: s(d.pay?.incentives),
  };
  const payText = formatPay({ ...pay, source: "structured", text: null });
  const salaryRange = payText || "";

  const benefits = {};
  if (d.evpMode !== "write") {
    for (const [k, v] of Object.entries(d.benefits || {})) if (isKey(BENEFITS, k)) benefits[k] = s(v);
  }

  const fields = {
    // business
    businessName: s(d.business?.name),
    industry: isKey(INDUSTRIES, d.business?.industry) ? d.business.industry : null,
    // the job
    lane: isKey(LANES, d.lane) ? d.lane : "professional",
    trade: isSkilled && isKey(TRADES, d.trade) ? d.trade : null,
    jobTitle: s(d.title) || tradeLabel || "",
    headcount: Math.max(1, parseInt(d.headcount, 10) || 1),
    functions,
    workTypes,
    city: s(d.city),
    state: s(d.state),
    pincode: s(d.pincode),
    experience: s(d.experience),
    workingHours: s(d.workingHours),
    education: s(d.education),
    responsibilities: lines(d.duties),
    skills: csv(d.skills),
    shortAssignment: short ? {
      duration: s(d.shortAssignment?.duration),
      startDate: s(d.shortAssignment?.startDate),
      urgency: isKey(URGENCY, d.shortAssignment?.urgency) ? d.shortAssignment.urgency : null,
      certTools: s(d.shortAssignment?.certTools),
    } : null,
    // pay
    pay,
    // why work with you
    benefits,
    evpText: d.evpMode === "write" ? s(d.evpText) : "",
    // contact + declaration
    contactPhone: s(d.contactPhone),
    notAgencyDeclaration: true,
    // legacy fields so older readers keep working
    category: functions.length ? labelOf(FUNCS, functions[0]) : "Other",
    jobType: workTypes.length ? labelOf(TYPES, workTypes[0]) : "",
    salaryRange,
    description: "",
  };
  if (storeId) fields.storeId = storeId;
  return fields;
}

// Fields whose change counts as a content edit (anything but Live/Filled/
// Closed): only these are saved, and an edit with none saves nothing.
export function changedContentKeys(before = {}, after = {}) {
  return Object.keys(after).filter(k => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}

// Business details remembered on the account for next time (users/{uid}.jobBusiness).
export const rememberedBusiness = (d) => ({
  name: s(d.business?.name),
  industry: isKey(INDUSTRIES, d.business?.industry) ? d.business.industry : "",
  city: s(d.business?.city),
});
