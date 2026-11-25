// L10 (launch): each job can shortlist at most `limit` applicants (default
// 10, admin-set in config/pricing). An applicant counts once — the first
// time they reach Shortlisted or later, i.e. when phone/email/CV unlock (L8).
// Moving them later, rejecting them or closing the job never frees a slot.
// Pure helpers; unit-tested in test/unit/shortlist.test.js. Enforced by
// firestore.rules (shortlistSlots + shortlistCount).
//
// Beta mode (Admin → Pricing, config/pricing.betaMode, ON unless switched off):
// no limit per job and no daily limit for search, but slots and counts are
// still recorded, so the limits can start from the real numbers.
export const DEFAULT_SHORTLIST_LIMIT = 10;
export const isBetaMode = (config) => config?.betaMode !== false;

export const shortlistCountOf = (job) => Number(job?.shortlistCount ?? job?.raw?.shortlistCount ?? 0) || 0;
export const shortlistLimitFrom = (config) => {
  const n = Number(config?.shortlistLimit);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SHORTLIST_LIMIT;
};
// A2: how many NEW people one employer may shortlist from Find candidates per
// day (Indian time), all jobs together. 0 = switched off. Enforced by the
// shortlistCandidate function. People who applied don't count.
export const DEFAULT_SEARCH_DAILY_LIMIT = 20;
export const MAX_SEARCH_DAILY_LIMIT = 500;
export const searchDailyLimitFrom = (config) => {
  const n = config?.searchShortlistDailyLimit;
  return Number.isInteger(n) && n >= 0 && n <= MAX_SEARCH_DAILY_LIMIT ? n : DEFAULT_SEARCH_DAILY_LIMIT;
};

// What applies right now: Infinity in beta, else the admin's number.
export const shortlistLimitNow = (config) => (isBetaMode(config) ? Infinity : shortlistLimitFrom(config));
export const searchDailyLimitNow = (config) => (isBetaMode(config) ? Infinity : searchDailyLimitFrom(config));
export const hasLimit = (limit) => Number.isFinite(limit);
// "Shortlists used: 7 of 10", or "Shortlists used: 7" while there's no limit.
export const shortlistsUsedText = (count, limit) =>
  (hasLimit(limit) ? `Shortlists used: ${Math.min(count, limit)} of ${limit}` : `Shortlists used: ${count}`);

export const shortlistsLeft = (job, limit) => Math.max(0, limit - shortlistCountOf(job));
export const isShortlistFull = (job, limit) => shortlistsLeft(job, limit) === 0;

export const SHORTLIST_FULL_MESSAGE = (limit) =>
  `You've used all ${limit} shortlists for this job. Post another job to shortlist more.`;

export class ShortlistFullError extends Error {
  constructor(limit) { super(SHORTLIST_FULL_MESSAGE(limit)); this.name = "ShortlistFullError"; this.limit = limit; }
}

// Split planned stage updates [{ app, update }] for one job: those that unlock
// contact need a slot — the first `left` get one, the rest are skipped; the
// others (already unlocked, or not unlocking) go through as normal.
export function planShortlistSlots(items, { count, limit }) {
  let left = Math.max(0, limit - count);
  const slotted = [], normal = [], overLimit = [];
  for (const it of items) {
    if (!it.update.contactUnlockedAt) normal.push(it);
    else if (left > 0) { slotted.push(it); left--; }
    else overLimit.push(it);
  }
  return { slotted, normal, overLimit };
}
