// TIN Jobs data model — normaliseJob() turns any jobListings document, old
// shape (category / jobType / salaryRange) or new shape (lane / functions /
// workTypes / pay …, see docs/JOBS_BLUEPRINT.md §3), into ONE shape for the UI.
//
// Rules: never invent a value. A field the document doesn't have comes back
// as null / [] / {} — the UI hides it. Old documents are never rewritten; this
// only reads them.
//
// Plain functions, zero React/Firebase imports, so it's importable from the
// Vite bundle, the Node prerender/sitemap scripts and unit tests.
import { parseSalaryRange } from "./salaryParser.js";
import {
  FUNCS, TYPES, SHORT_TYPES, TRADES, BENEFITS, PAY_PERIODS, PAY_DISPLAY, URGENCY, LANES, INDUSTRIES,
  isKey, keyForLabel, labelOf,
} from "../data/jobsTaxonomy.js";

// The only legacy category that maps to a lane (approved exception, exact match).
export const LEGACY_SKILLED_CATEGORY = "Site & Skilled Trades";

const str = (v) => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v) => str(v) || null;
const posNum = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

// ── Legacy pay (free-text salaryRange) ───────────────────────

// Shorthand like "25k", "3 lakh", "2.5 L", "1 cr" isn't expanded by
// parseSalaryRange (it would read "₹25k" as ₹25), so treat it as unreadable.
const SHORTHAND_RE = /\d\s*(k|l|lpa|lac|lacs|lakh|lakhs|cr|crore|crores|thousand)\b/i;
// A monthly/yearly amount below these means the parser picked up some other
// number in the text (e.g. "+ 2 incentives", "age 18-30"), not the salary.
const MIN_PLAUSIBLE = { month: 1000, year: 12000 };
const UNIT_TO_PERIOD = { MONTH: "month", YEAR: "year", DAY: "day", HOUR: "hour" }; // WEEK has no pay period

// Returns { period, min, max } when the text can be read confidently, else null.
export function parseLegacyPay(salaryRange) {
  if (typeof salaryRange !== "string" || SHORTHAND_RE.test(salaryRange)) return null;
  const parsed = parseSalaryRange(salaryRange);
  if (!parsed) return null;
  const period = UNIT_TO_PERIOD[parsed.unitText];
  if (!period) return null;
  const floor = MIN_PLAUSIBLE[period];
  if (floor && parsed.minValue < floor) return null;
  return { period, min: parsed.minValue, max: parsed.maxValue };
}

// ── Pay display text ─────────────────────────────────────────

const inr = (n) => n.toLocaleString("en-IN");

// Display string for a normalised pay object, matching the prototype's
// payText(): "Negotiable" / "Not disclosed" / "₹22,000–28,000 / month" / the
// original free text. Returns null when there's nothing to show.
export function formatPay(pay) {
  if (!pay) return null;
  const displayText = PAY_DISPLAY.find(d => d.key === pay.display)?.text;
  if (displayText) return displayText;
  if (pay.source === "structured" && pay.min) {
    const suffix = PAY_PERIODS.find(p => p.key === pay.period)?.suffix;
    const range = pay.max && pay.max !== pay.min ? `₹${inr(pay.min)}–${inr(pay.max)}` : `₹${inr(pay.min)}`;
    const text = suffix ? `${range} ${suffix}` : range;
    // L7: "Negotiable" may be shown next to the range.
    return pay.negotiable ? `${text} · Negotiable` : text;
  }
  return pay.text || null;
}

function normalisePay(raw) {
  const p = raw.pay;
  if (p && typeof p === "object") {
    const min = posNum(p.min);
    const max = posNum(p.max);
    return {
      source: "structured",
      period: isKey(PAY_PERIODS, p.period) ? p.period : null,
      min,
      max: max != null && min != null && max < min ? null : max,
      display: isKey(PAY_DISPLAY, p.display) ? p.display : null,
      negotiable: p.negotiable === true,
      incentives: strOrNull(p.incentives),
      text: strOrNull(raw.salaryRange),
    };
  }
  const text = strOrNull(raw.salaryRange);
  if (!text) return null;
  const parsed = parseLegacyPay(text);
  return {
    source: "legacy",
    period: parsed?.period ?? null,
    min: parsed?.min ?? null,
    max: parsed?.max ?? null,
    display: null,
    negotiable: false,
    incentives: null,
    text,
  };
}

// ── Other fields ─────────────────────────────────────────────

function keyList(value, list) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(k => isKey(list, k)))];
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function normaliseShortAssignment(sa) {
  if (!sa || typeof sa !== "object") return null;
  const out = {
    duration: strOrNull(sa.duration),
    startDate: strOrNull(sa.startDate),
    urgency: isKey(URGENCY, sa.urgency) ? sa.urgency : null,
    certTools: strOrNull(sa.certTools),
  };
  return Object.values(out).some(v => v != null) ? out : null;
}

function normaliseBenefits(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return {};
  const out = {};
  for (const [k, v] of Object.entries(b)) {
    if (isKey(BENEFITS, k)) out[k] = str(v);
  }
  return out;
}

// A job is a short assignment ("Needed Now") if any work type is a short type
// or it has an assignment duration.
export function isNeededNow(job) {
  return (job.workTypes || []).some(t => SHORT_TYPES.includes(t)) || !!job.shortAssignment?.duration;
}

// ── normaliseJob ─────────────────────────────────────────────

export function normaliseJob(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Functions: new-shape keys win; else map the legacy category only on an
  // EXACT label match (e.g. "Sales & Business Development"). Anything else
  // keeps its old label in legacyCategory for display — no guessing.
  let functions = keyList(raw.functions, FUNCS);
  let legacyCategory = null;
  if (!functions.length && str(raw.category)) {
    const k = keyForLabel(FUNCS, raw.category.trim());
    if (k) functions = [k];
    else legacyCategory = raw.category.trim();
  }

  // Work types: same rule. "Full-time"/"Part-time" match exactly; legacy
  // "Contract" has no exact match and stays as legacyJobType.
  let workTypes = keyList(raw.workTypes, TYPES);
  let legacyJobType = null;
  if (!workTypes.length && str(raw.jobType)) {
    const k = keyForLabel(TYPES, raw.jobType.trim());
    if (k) workTypes = [k];
    else legacyJobType = raw.jobType.trim();
  }

  // Lane: a stored lane wins. Old jobs are professional, except the one
  // approved exact-name exception: legacy category "Site & Skilled Trades"
  // → skilled (no trade is recorded, so they show under "All trades").
  let lane = "professional";
  if (isKey(LANES, raw.lane)) lane = raw.lane;
  else if (str(raw.category) === LEGACY_SKILLED_CATEGORY) lane = "skilled";

  const job = {
    id: raw.id ?? null,
    isLegacy: raw.lane == null,
    lane,
    trade: isKey(TRADES, raw.trade) ? raw.trade : null,

    title: str(raw.jobTitle),
    description: str(raw.description),
    responsibilities: stringList(raw.responsibilities),
    skills: stringList(raw.skills),

    functions,
    legacyCategory,
    workTypes,
    legacyJobType,

    headcount: Number.isInteger(raw.headcount) && raw.headcount > 0 ? raw.headcount : null,
    experience: strOrNull(raw.experience),
    education: strOrNull(raw.education),
    workingHours: strOrNull(raw.workingHours),
    shortAssignment: normaliseShortAssignment(raw.shortAssignment),

    pay: normalisePay(raw),
    benefits: normaliseBenefits(raw.benefits),
    evpText: strOrNull(raw.evpText),

    city: str(raw.city),
    state: str(raw.state),
    pincode: str(raw.pincode),

    industry: isKey(INDUSTRIES, raw.industry) ? raw.industry : null,
    storeId: str(raw.storeId) || null,
    businessName: str(raw.businessName),
    postedByName: str(raw.postedByName),
    postedByUid: raw.postedByUid ?? null,
    postedByType: raw.postedByType ?? null,
    contactPhone: str(raw.contactPhone),

    status: raw.status ?? null,
    jobStatus: raw.jobStatus ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };

  job.isNeededNow = isNeededNow(job);
  job.payText = formatPay(job.pay);
  job.functionLabels = job.functions.map(k => labelOf(FUNCS, k));
  job.workTypeLabels = job.workTypes.map(k => labelOf(TYPES, k));
  job.industryLabel = job.industry ? labelOf(INDUSTRIES, job.industry) : null;
  job.tradeLabel = job.trade ? labelOf(TRADES, job.trade) : null;
  job.tradeLabelHi = job.trade ? TRADES.find(t => t.key === job.trade).labelHi : null;
  return job;
}
