// Client-side filters for the Jobs pages. Every filter works on a job that
// has already been through normaliseJob() (src/utils/jobModel.js).
//
// Rule: never guess. A job whose pay or experience can't be read with
// confidence (and any job whose pay is "Negotiable" / "Don't disclose")
// only shows when that filter is on "Any".
//
// Plain functions, zero React/Firebase imports, so they're unit-testable.

// ── Pay bands ────────────────────────────────────────────────
// A band covers (min, max]; the first band of each period starts at 0 and
// the last has no upper end. A job counts in a band if any part of its pay
// range falls inside it, so a range spanning two bands shows in both.
// A job only matches bands of its own pay period ("year" is compared as
// month ÷ 12). Day pay is never turned into month pay or vice versa.
export const PAY_BANDS = [
  { id: "m_upto15k", period: "month", label: "Up to ₹15k / month", min: 0, max: 15000 },
  { id: "m_15_25k", period: "month", label: "₹15k–25k / month", min: 15000, max: 25000 },
  { id: "m_25_40k", period: "month", label: "₹25k–40k / month", min: 25000, max: 40000 },
  { id: "m_40_60k", period: "month", label: "₹40k–60k / month", min: 40000, max: 60000 },
  { id: "m_60kplus", period: "month", label: "₹60k+ / month", min: 60000, max: Infinity },
  { id: "d_upto600", period: "day", label: "Up to ₹600 / day", min: 0, max: 600 },
  { id: "d_600_900", period: "day", label: "₹600–900 / day", min: 600, max: 900 },
  { id: "d_900_1200", period: "day", label: "₹900–1,200 / day", min: 900, max: 1200 },
  { id: "d_1200plus", period: "day", label: "₹1,200+ / day", min: 1200, max: Infinity },
];

const HIDDEN_PAY = ["negotiable", "undisclosed"];

// Returns { period: "month"|"day", min, max } usable for banding, or null.
export function bandablePay(pay) {
  if (!pay || pay.min == null) return null;
  if (HIDDEN_PAY.includes(pay.display)) return null; // never filter on hidden pay
  const max = pay.max ?? pay.min;
  if (pay.period === "month") return { period: "month", min: pay.min, max };
  if (pay.period === "year") return { period: "month", min: pay.min / 12, max: max / 12 };
  if (pay.period === "day") return { period: "day", min: pay.min, max };
  return null; // hour / project / unknown → only under "Any"
}

export function jobMatchesPayBand(job, bandId) {
  if (!bandId) return true;
  const band = PAY_BANDS.find(b => b.id === bandId);
  if (!band) return true;
  const pay = bandablePay(job?.pay);
  if (!pay || pay.period !== band.period) return false;
  return pay.max > band.min && pay.min <= band.max;
}

// ── Experience bands ─────────────────────────────────────────
// Closed ranges in years. A job counts in every band its range overlaps.
export const EXPERIENCE_BANDS = [
  { id: "fresher", label: "Fresher", min: 0, max: 0 },
  { id: "0_2", label: "0–2 years", min: 0, max: 2 },
  { id: "2_5", label: "2–5 years", min: 2, max: 5 },
  { id: "5_10", label: "5–10 years", min: 5, max: 10 },
  { id: "10plus", label: "10+ years", min: 10, max: Infinity },
];

const NUM = "(\\d+(?:\\.\\d+)?)";
const UNIT = "\\s*(?:yrs?|years?)?\\.?";
const RANGE_RE = new RegExp(`^${NUM}\\s*(?:-|–|—|to)\\s*${NUM}${UNIT}$`, "i");
const PLUS_RE = new RegExp(`^${NUM}\\s*\\+${UNIT}$`, "i");
const SINGLE_RE = new RegExp(`^${NUM}\\s*(?:yrs?|years?)\\.?$`, "i");

// Reads only clear patterns from the free-text experience field:
// "Fresher", "Any", "2–4 yrs", "2-4 years", "3+ yrs", "5 years".
// Returns { min, max } in years, or null when unclear.
export function parseExperience(text) {
  if (typeof text !== "string") return null;
  const s = text.trim();
  if (!s) return null;
  if (/^freshers?$/i.test(s)) return { min: 0, max: 0 };
  if (/^any$/i.test(s)) return { min: 0, max: Infinity };
  let m = s.match(RANGE_RE);
  if (m) {
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    return a <= b ? { min: a, max: b } : null;
  }
  m = s.match(PLUS_RE);
  if (m) return { min: parseFloat(m[1]), max: Infinity };
  m = s.match(SINGLE_RE);
  if (m) { const a = parseFloat(m[1]); return { min: a, max: a }; }
  return null;
}

export function jobMatchesExperience(job, bandId) {
  if (!bandId) return true;
  const band = EXPERIENCE_BANDS.find(b => b.id === bandId);
  if (!band) return true;
  const exp = parseExperience(job?.experience);
  if (!exp) return false;
  return exp.min <= band.max && exp.max >= band.min;
}

// ── Other filters ────────────────────────────────────────────

const lc = (s) => (s || "").toLowerCase();

export function jobMatchesSearch(job, q) {
  const needle = lc(q).trim();
  if (!needle) return true;
  const hay = [
    job.title, job.businessName, job.postedByName, job.city, job.state,
    job.description, job.legacyCategory, job.tradeLabel, job.tradeLabelHi, job.industryLabel,
    ...(job.skills || []), ...(job.functionLabels || []),
  ].map(lc).join(" ");
  return needle.split(/\s+/).every(w => hay.includes(w));
}

// Lane "needed-now" is derived; "professional" / "skilled" are stored lanes.
export function jobInLane(job, lane) {
  if (!lane) return true;
  if (lane === "needed-now") return !!job.isNeededNow;
  return job.lane === lane;
}

// f = { lane, q, fn, trade, ind, type, city, exp, pay } — empty values mean "Any".
// Old jobs have no industry, so they only match when `ind` is empty.
export function jobMatchesFilters(job, f = {}) {
  if (!jobInLane(job, f.lane)) return false;
  if (!jobMatchesSearch(job, f.q)) return false;
  if (f.fn && !(job.functions || []).includes(f.fn)) return false;
  if (f.trade && job.trade !== f.trade) return false;
  if (f.ind && job.industry !== f.ind) return false;
  if (f.type && !(job.workTypes || []).includes(f.type)) return false;
  if (f.city && !lc(job.city).includes(lc(f.city).trim())) return false;
  if (!jobMatchesExperience(job, f.exp)) return false;
  if (!jobMatchesPayBand(job, f.pay)) return false;
  return true;
}

// Filter keys that live in the URL query string (?q=&fn=&trade=&ind=&type=&city=&exp=&pay=).
export const FILTER_KEYS = ["q", "fn", "trade", "ind", "type", "city", "exp", "pay"];

export function filtersFromSearchParams(params) {
  const f = {};
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v) f[k] = v;
  }
  return f;
}
