// L9 (launch): pricing switch — no payments yet. Admin sets, per fee, a list
// price, an offer price and a "Launch discount" toggle (ON = ₹0) in
// config/pricing (firestore.rules: admin-only write, public read). Every free
// profile or job post is recorded as an entitlement valid for 365 days, so
// history exists when payments start. Pure helpers, unit-tested in
// test/unit/pricing.test.js.
import { DEFAULT_SHORTLIST_LIMIT, MAX_SEARCH_DAILY_LIMIT, isBetaMode, searchDailyLimitFrom, shortlistLimitFrom } from "./shortlist.js";

export const FEE_KINDS = { profile: "profileFee", jobPost: "jobPostFee" };
export const DEFAULT_FEE = { list: 750, offer: 100, launchDiscount: true };
export const ENTITLEMENT_DAYS = 365;

const money = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : d; };
const fee = (f) => ({
  list: money(f?.list, DEFAULT_FEE.list),
  offer: money(f?.offer, DEFAULT_FEE.offer),
  launchDiscount: typeof f?.launchDiscount === "boolean" ? f.launchDiscount : DEFAULT_FEE.launchDiscount,
});

// config/pricing → a complete, safe shape (defaults for anything missing).
export function pricingFrom(config) {
  return {
    betaMode: isBetaMode(config),
    profileFee: fee(config?.profileFee),
    jobPostFee: fee(config?.jobPostFee),
    shortlistLimit: config ? shortlistLimitFrom(config) : DEFAULT_SHORTLIST_LIMIT,
    searchShortlistDailyLimit: searchDailyLimitFrom(config),
  };
}

// The fee that applies now ("profileFee" / "jobPostFee"): in beta mode
// everything is free, whatever the launch discount says.
export const feeInForce = (pricing, key) => (pricing.betaMode ? { ...pricing[key], launchDiscount: true } : pricing[key]);

// What the user pays now: ₹0 while the launch discount is on, else the offer price.
export const feeNow = (f) => (f.launchDiscount ? 0 : f.offer);

// Text for the price line on the profile / post-job screens.
// { struck: 750, now: 0, label: "Free during launch" } or { struck: 750, now: 100, label: "₹100" }.
export function priceDisplay(f) {
  const now = feeNow(f);
  return {
    struck: f.list > now ? f.list : null,
    now,
    label: now === 0 ? (f.launchDiscount ? "Free during launch" : "Free") : `₹${now.toLocaleString("en-IN")}`,
  };
}

// Admin form validation → list of { field, message }.
export function validatePricing(p) {
  const errs = [];
  for (const [key, name] of [["profileFee", "Job-seeker profile"], ["jobPostFee", "Job post"]]) {
    const f = p[key] || {};
    for (const part of ["list", "offer"]) {
      const n = Number(f[part]);
      if (!Number.isInteger(n) || n < 0 || n > 100000) errs.push({ field: `${key}.${part}`, message: `${name}: ${part} price must be a whole number of rupees (0–1,00,000).` });
    }
    const okNum = (v) => Number.isInteger(Number(v)) && Number(v) >= 0;
    if (okNum(f.list) && okNum(f.offer) && Number(f.offer) > Number(f.list)) {
      errs.push({ field: `${key}.offer`, message: `${name}: offer price can't be more than the list price.` });
    }
  }
  const lim = Number(p.shortlistLimit);
  if (!Number.isInteger(lim) || lim < 1 || lim > 999) errs.push({ field: "shortlistLimit", message: "Shortlist limit must be a whole number from 1 to 999." });
  const raw = p.searchShortlistDailyLimit;
  const day = raw === "" || raw == null ? NaN : Number(raw);
  if (!Number.isInteger(day) || day < 0 || day > MAX_SEARCH_DAILY_LIMIT) errs.push({ field: "searchShortlistDailyLimit", message: `Daily search shortlists must be a whole number from 0 to ${MAX_SEARCH_DAILY_LIMIT}.` });
  return errs;
}

// The entitlements/{id} document for a free profile or job post (shape
// enforced by firestore.rules; grantedAt / validUntil added by the writer).
export const entitlementId = (kind, refId) => `${kind}_${refId}`;
export function entitlementDoc(kind, uid, refId, f) {
  return {
    uid,
    kind,                // "job_profile" | "job_post"
    refId,               // the profile's uid / the job's id
    priceList: f.list,
    priceOffer: f.offer,
    launchDiscount: f.launchDiscount,
    pricePaid: 0,        // no payments yet
    reason: f.launchDiscount ? "launch_discount" : "payments_not_live",
  };
}

export const validUntilFrom = (date) => new Date(date.getTime() + ENTITLEMENT_DAYS * 24 * 60 * 60 * 1000);
