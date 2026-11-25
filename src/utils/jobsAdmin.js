// Admin → TIN Jobs Admin: turns the raw collections into the rows, counts and
// filters the screens show. Plain functions, zero React/Firebase imports —
// unit-tested in test/unit/jobsAdmin.test.js. Reads: src/lib/jobsAdmin.js.
//
// Who counts as what (docs/JOBS_BLUEPRINT.md §10):
//  - job seeker: has a job profile, or applied to at least one job;
//  - employer:   posted a job, or the account is a business (retailer role, or
//                linked to a store — the same signals as utils/jobRoles.js).
// One account can be both.
import { FUNCS, INDUSTRIES, LANES, TRADES, isKey, labelOf } from "../data/jobsTaxonomy.js";
import { currentStage, isContactUnlocked, isFromSearch } from "./applications.js";
import { vacancyTab, weekRange } from "./employerDesk.js";
import { normaliseJob } from "./jobModel.js";
import { isApplyReady, profileFromDocs } from "./jobProfile.js";
import { isEmployerByAccount } from "./jobRoles.js";
import { isSyntheticPhoneEmail } from "./phoneAuth.js";
import { isTakenDown } from "./jobModeration.js";
import { hasLimit, isShortlistFull, shortlistCountOf } from "./shortlist.js";
import { claimChecks } from "./storeClaim.js";
import { isImportedStore } from "./storeVisibility.js";

const s = (v) => (typeof v === "string" ? v.trim() : v == null || typeof v === "object" ? "" : String(v).trim());
const list = (v) => (Array.isArray(v) ? v : []);

// Firestore Timestamp, ISO string, number or Date → Date, else null.
export function toDate(v) {
  if (!v) return null;
  const d = typeof v.toDate === "function" ? v.toDate()
    : typeof v.seconds === "number" ? new Date(v.seconds * 1000)
    : v instanceof Date || typeof v === "string" || typeof v === "number" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");

// Phone-number accounts have an internal made-up email — never show it.
export const realEmail = (e) => (s(e) && !isSyntheticPhoneEmail(s(e)) ? s(e) : "");
const phoneFromSynthetic = (e) => (isSyntheticPhoneEmail(s(e)) ? s(e).split("@")[0] : "");
const accountEmail = (u) => realEmail(u?.email) || realEmail(u?.workEmail) || realEmail(u?.personalEmail);
const accountPhone = (u) => s(u?.phone) || phoneFromSynthetic(u?.email);

const groupBy = (rows, key) => {
  const m = {};
  for (const r of rows) if (r[key]) (m[r[key]] = m[r[key]] || []).push(r);
  return m;
};
const byId = (rows) => Object.fromEntries(rows.map(r => [r.id, r]));
const newestFirst = (a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0);

// ── Resumes ──────────────────────────────────────────────────
// Where a resume may be opened from. Paths and links are written by the
// candidate, so: only files in their own folder, only Firebase Storage links
// (a hand-made application can't put another site or a script behind the
// admin's "View" button).
const STORAGE_LINK = /^https:\/\/(firebasestorage\.googleapis\.com|[a-z0-9-]+\.firebasestorage\.app)\//i;
export function resumeSource(uid, { path, url, fileName } = {}) {
  const p = s(path);
  if (p && uid && p.startsWith(`resumes/${uid}/`) && !p.includes("..")) return { path: p, fileName: s(fileName) || "Resume" };
  const u = s(url);
  return STORAGE_LINK.test(u) ? { url: u, fileName: s(fileName) || "Resume" } : null;
}
export const contactResume = (uid, c) => (c ? resumeSource(uid, { path: c.resumePath, url: c.resumeUrl, fileName: c.resumeFileName }) : null);
// Applications from before L8 carry the contact on the application itself.
export const legacyContact = (a) => (a && (a.applicantPhone || a.applicantEmail || a.resumePath || a.resumeUrl) ? a : null);

// ── Jobs ─────────────────────────────────────────────────────
export const JOB_STATES = [
  { key: "open", label: "Open" },
  { key: "paused", label: "Paused" },
  { key: "filled", label: "Filled" },
  { key: "closed", label: "Closed" },
  { key: "pending", label: "Waiting" },
  { key: "rejected", label: "Taken down" },
];
export const jobStateLabel = (k) => JOB_STATES.find(x => x.key === k)?.label || k;
// Taken down wins; then, as on the Employer Desk, paused / filled / closed; a
// job from before beta that nobody approved is waiting, never "open".
export function jobState(job) {
  if (isTakenDown(job)) return "rejected";
  const tab = vacancyTab(job);
  if (tab !== "live") return tab;
  return job?.status === "approved" ? "open" : "pending";
}

export function buildJobs({ jobs, applications, users, limit }) {
  const apps = groupBy(applications, "jobId");
  const userBy = byId(users);
  return jobs.map(j => {
    const n = normaliseJob(j);
    const mine = apps[j.id] || [];
    const poster = userBy[j.postedByUid];
    return {
      id: j.id, raw: j,
      title: n.title || "(untitled job)",
      employer: n.businessName || n.postedByName || s(poster?.name),
      employerUid: s(j.postedByUid),
      employerPhone: n.contactPhone || accountPhone(poster),
      employerEmail: accountEmail(poster),
      city: n.city,
      roles: [...new Set([n.tradeLabel, ...n.functionLabels, n.legacyCategory].filter(Boolean))],
      payText: n.payText || "",
      state: jobState(j),
      created: toDate(j.createdAt),
      applicants: mine.length,
      slots: shortlistCountOf(j),
      limit,
      full: isShortlistFull(j, limit),
      // Everyone ever shortlisted; can exceed `slots` for shortlists made before L10.
      shortlisted: mine.filter(isContactUnlocked).length,
    };
  }).sort(newestFirst);
}
export const shortlistText = (j) => usedOf(j.slots, j.limit);
// "3/10", or just "3" while there's no limit (beta mode).
export const usedOf = (used, limit) => (hasLimit(limit) ? `${used}/${limit}` : String(used));

// ── Job seekers ──────────────────────────────────────────────
export const LANE_OPTIONS = [["professional", "White-collar"], ["skilled", "Skilled / blue-collar"]];
export const laneText = (k) => LANE_OPTIONS.find(([x]) => x === k)?.[1] || "";
export const PROFILE_OPTIONS = ["Complete", "Incomplete", "No profile"].map(v => [v, v]);
// "Complete" = the app's own minimum to apply (name, mobile, role/trade, city).
function profileState(p, q, u) {
  if (!p) return "No profile";
  const pr = profileFromDocs({ ...p, skills: list(p.skills) }, q, u || {});
  return isApplyReady(pr, pr.lane) ? "Complete" : "Incomplete";
}

// `contacts` = { [applicationId]: private/contact doc } for the ones loaded.
export function buildSeekers({ profiles, privates, users, applications, contacts = {} }) {
  const pubBy = byId(profiles), privBy = byId(privates), userBy = byId(users);
  const appsBy = groupBy(applications, "applicantUid");
  const uids = new Set([...Object.keys(pubBy), ...Object.keys(privBy), ...Object.keys(appsBy)]);
  return [...uids].map(uid => {
    const p = pubBy[uid], q = privBy[uid] || {}, u = userBy[uid];
    const apps = (appsBy[uid] || []).slice()
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    const cs = apps.map(a => contacts[a.id] || legacyContact(a)).filter(Boolean);
    const firstOf = (key) => s(cs.find(c => s(c[key]))?.[key]);
    const src = p || apps[0]?.profileSnapshot || {};
    const trades = list(src.trades).map(k => labelOf(TRADES, k)).filter(Boolean);
    const functions = list(src.functions).map(k => labelOf(FUNCS, k)).filter(Boolean);
    const role = s(src.role);
    const expectedPay = s(q.expectedPay) || s(apps.find(a => s(a.expectedPay))?.expectedPay);
    return {
      uid,
      hasProfile: !!p,
      lane: isKey(LANES, src.lane) ? src.lane : "",
      profile: profileState(p, q, u),
      joined: toDate(u?.createdAt) || toDate(p?.createdAt) || toDate(apps[apps.length - 1]?.createdAt),
      name: s(p?.name) || s(apps[0]?.applicantName) || s(u?.name) || "(no name)",
      phone: s(q.phone) || firstOf("applicantPhone") || accountPhone(u),
      email: realEmail(q.email) || realEmail(firstOf("applicantEmail")) || accountEmail(u),
      city: s(src.city) || s(u?.city),
      areas: s(src.areas),
      role,
      roles: [...new Set([...trades, ...functions])],
      roleText: [role, ...trades].filter(Boolean).join(", ") || functions.join(", "),
      skills: list(src.skills).map(s).filter(Boolean),
      experienceYears: s(src.experienceYears),
      expectedPay,
      currentPay: s(q.currentPay) || s(apps.find(a => s(a.currentPay))?.currentPay),
      payHidden: !!expectedPay && q.showPayToEmployers !== true,
      visibility: s(p?.visibility),
      openToEmployers: typeof p?.openToEmployers === "boolean" ? p.openToEmployers : null,
      snapshot: src,
      created: toDate(p?.createdAt) || toDate(u?.createdAt) || toDate(apps[apps.length - 1]?.createdAt),
      resume: resumeSource(uid, { path: q.cv?.path, fileName: q.cv?.fileName })
        || cs.map(c => contactResume(uid, c)).find(Boolean) || null,
      applications: apps,
      applied: apps.filter(a => !isFromSearch(a)).length, // A2: found in search isn't applying
      shortlisted: apps.filter(isContactUnlocked).length,
    };
  }).sort(newestFirst);
}

// Applications whose private/contact doc is needed to complete a seeker row
// (no contact on the job profile, or a CV only sent with an application).
export function contactsNeeded({ privates, applications }) {
  const privBy = byId(privates);
  return applications.filter(a => {
    if (legacyContact(a)) return false;
    const q = privBy[a.applicantUid];
    return !s(q?.phone) || !s(q?.email) || (!!a.hasCv && !q?.cv?.path);
  }).map(a => a.id);
}

// ── Employers ────────────────────────────────────────────────
const ROLE_LABEL = { jobseeker: "Job seeker", employer: "Business", retailer: "Retailer", contractor: "Contractor", architect: "Architect", contributor: "Market Champion", consumer: "Individual" };

// `stores` = { [storeId]: store } for the linked stores.
export function buildEmployers({ users, jobRows, stores = {} }) {
  const jobsBy = groupBy(jobRows, "employerUid");
  const userBy = byId(users);
  const uids = new Set([...Object.keys(jobsBy), ...users.filter(isEmployerByAccount).map(u => u.id)]);
  return [...uids].map(uid => {
    const u = userBy[uid] || {}, mine = jobsBy[uid] || [], latest = mine[0];
    const store = u.storeId ? stores[u.storeId] : null;
    return {
      uid,
      business: s(store?.storeName) || s(u.jobBusiness?.name) || s(u.storeName) || s(latest?.raw?.businessName) || s(u.company),
      contact: s(u.name) || s(latest?.raw?.postedByName),
      phone: accountPhone(u) || s(latest?.employerPhone) || s(store?.phone),
      email: accountEmail(u) || realEmail(store?.email),
      city: s(store?.city) || s(u.jobBusiness?.city) || s(u.city) || s(latest?.city),
      type: labelOf(INDUSTRIES, u.jobBusiness?.industry) || s(store?.businessType) || ROLE_LABEL[u.role] || "",
      dealsIn: Array.isArray(u.dealsIn) ? u.dealsIn.map(s).filter(Boolean).join(", ") : "", // B1 sign-up
      verified: u.verificationStatus === "verified" ? "Verified"
        : store?.verificationStatus === "verified" ? "Store verified" : "Not verified",
      storeId: s(u.storeId),
      jobs: mine.length,
      openJobs: mine.filter(j => j.state === "open").length,
      slots: mine.reduce((n, j) => n + j.slots, 0),
      slotsTotal: mine.reduce((n, j) => n + j.limit, 0),
      created: toDate(u.createdAt) || mine[mine.length - 1]?.created || null,
    };
  }).sort(newestFirst);
}

// ── Businesses ───────────────────────────────────────────────
// TIN has no single "business" collection or "approved" field. A business is
// an employer account (above), someone claiming a business, or a store page
// no account covers (never a bulk-imported listing that TIN hasn't verified
// and nobody claimed). Its status comes from the real fields:
//  - pending:  a claim with status "pending", or a self-listed store that is
//              still "community_added" (TIN has to act);
//  - approved: account verified, store verified, or TIN linked the store to
//              the account (users.storeId / stores.claimedByUid — admin-only);
//  - rejected: store "rejected", or the latest claim rejected;
//  - none:     nothing is waiting for TIN and nothing was approved.
export const BUSINESS_STATES = [["approved", "Approved"], ["pending", "Pending approval"], ["rejected", "Rejected"], ["none", "Not verified"]];
export const businessStateLabel = (k) => BUSINESS_STATES.find(([x]) => x === k)?.[1] || k;

// Stores this dashboard needs, out of the whole directory.
export const isBusinessStore = (x) => !!x && x.type !== "individual"
  && (!isImportedStore(x) || x.verificationStatus === "verified" || !!x.claimedByUid);
const storeNeedsReview = (x, linkedIds) => !!x && x.type !== "individual" && !isImportedStore(x) && !x.claimedByUid && !linkedIds.has(x.id)
  && (x.verificationStatus || "community_added") === "community_added";
const linkedStoreIds = (users) => new Set(users.map(u => s(u.storeId)).filter(Boolean));

// What TIN has to approve or reject, oldest first.
export function buildApprovals({ users, claims = [], stores = {} }) {
  const userBy = byId(users), linked = linkedStoreIds(users);
  const claimRows = claims.filter(c => c.status === "pending").map(c => {
    const claimant = userBy[c.claimantUid] || null, store = stores[c.storeId] || null;
    const full = { ...c, claimant, store };
    const chk = claimChecks(full);
    return {
      key: "claim_" + c.id, kind: "claim", kindText: "Claims a listed business", claim: c, storeId: s(c.storeId), uid: s(c.claimantUid),
      business: s(store?.storeName) || s(c.storeName) || "(unknown store)", city: s(store?.city) || s(c.storeCity),
      owner: s(c.name) || s(claimant?.name), phone: s(c.phone), email: realEmail(c.email) || accountEmail(claimant), gst: s(c.gst),
      created: toDate(c.createdAt),
      blocked: chk.legacy ? "Old claim with no account — it can only be rejected." : chk.takenByOther ? "Already claimed by another account." : "",
      warning: chk.otherLink ? "This account is already linked to another store. Approving moves the link to this one." : "",
    };
  });
  const storeRows = Object.values(stores).filter(x => storeNeedsReview(x, linked)).map(x => {
    const by = userBy[x.contributorId];
    return {
      key: "store_" + x.id, kind: "store", kindText: by?.role === "contributor" ? "Added by a Market Champion" : "New listing", storeId: x.id, uid: s(x.contributorId),
      business: s(x.storeName) || "(no name)", city: s(x.city),
      owner: s(x.ownerName) || s(by?.name), phone: s(x.phone) || accountPhone(by), email: realEmail(x.email) || accountEmail(by), gst: s(x.gst),
      created: toDate(x.createdAt), blocked: "", warning: "",
    };
  });
  return [...claimRows, ...storeRows].sort((a, b) => (a.created?.getTime() || 0) - (b.created?.getTime() || 0));
}

const newestClaim = (claims) => claims.slice().sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))[0];

export function buildBusinesses({ users, jobRows, stores = {}, claims = [], employers, approvals }) {
  const userBy = byId(users);
  const pendingStores = new Set(approvals.filter(a => a.kind === "store").map(a => a.storeId));
  const pendingClaimants = new Set(approvals.filter(a => a.kind === "claim").map(a => a.uid));
  const claimsBy = groupBy(claims, "claimantUid");
  const all = Object.values(stores).filter(isBusinessStore);
  const used = linkedStoreIds(users); // stores already shown on an account's row

  const accounts = new Map(employers.map(e => [e.uid, e]));
  for (const [uid, mine] of Object.entries(claimsBy)) {
    if (accounts.has(uid)) continue;
    const u = userBy[uid] || {}, c = newestClaim(mine);
    accounts.set(uid, {
      uid, business: "", contact: s(u.name) || s(c.name), phone: accountPhone(u) || s(c.phone), email: accountEmail(u) || realEmail(c.email),
      city: s(u.city) || s(c.storeCity), type: "", verified: "Not verified", storeId: "", jobs: 0, openJobs: 0, slots: 0, slotsTotal: 0,
      created: toDate(u.createdAt) || toDate(c.createdAt),
    });
  }
  const rows = [...accounts.values()].map(e => {
    const u = userBy[e.uid] || {};
    // The account's store: the linked one, else one they listed themselves
    // (Market Champions and the admin list other people's stores).
    let store = e.storeId ? stores[e.storeId] : null;
    if (!e.storeId && u.role !== "contributor" && u.role !== "admin") {
      store = all.find(x => !used.has(x.id) && !isImportedStore(x) && x.contributorId === e.uid) || null;
      if (store) used.add(store.id);
    }
    const claim = newestClaim(claimsBy[e.uid] || []);
    const state = pendingClaimants.has(e.uid) || (store && pendingStores.has(store.id)) ? "pending"
      : u.verificationStatus === "verified" || store?.verificationStatus === "verified" || e.storeId ? "approved"
      : store?.verificationStatus === "rejected" || claim?.status === "rejected" ? "rejected" : "none";
    return {
      ...e, key: "u_" + e.uid, state, storeId: e.storeId || store?.id || "",
      verified: e.verified === "Not verified" && store?.verificationStatus === "verified" ? "Store verified" : e.verified,
      phone: e.phone || s(claim?.phone) || s(store?.phone),
      business: e.business || s(store?.storeName) || s(claim?.storeName),
      city: e.city || s(store?.city), contact: e.contact || s(store?.ownerName), type: e.type || s(store?.businessType),
    };
  });
  for (const x of all) {
    if (used.has(x.id)) continue;
    const owner = userBy[x.claimedByUid];
    const jobs = jobRows.filter(j => j.raw?.storeId === x.id);
    rows.push({
      key: "s_" + x.id, uid: s(x.claimedByUid), storeId: x.id,
      state: pendingStores.has(x.id) ? "pending" : x.verificationStatus === "verified" || x.claimedByUid ? "approved" : x.verificationStatus === "rejected" ? "rejected" : "none",
      business: s(x.storeName), contact: s(owner?.name) || s(x.ownerName), phone: s(x.phone), email: realEmail(x.email), city: s(x.city), type: s(x.businessType),
      verified: x.verificationStatus === "verified" ? "Store verified" : "Not verified",
      jobs: jobs.length, openJobs: jobs.filter(j => j.state === "open").length,
      slots: jobs.reduce((n, j) => n + j.slots, 0), slotsTotal: jobs.reduce((n, j) => n + j.limit, 0),
      created: toDate(x.createdAt),
    });
  }
  return rows.sort(newestFirst);
}

// ── Recent activity ──────────────────────────────────────────
// Latest sign-ups, job posts and applications, newest first.
export function buildActivity({ users, jobRows, applications }, max = 50) {
  const jobBy = byId(jobRows);
  const rows = [
    ...users.map(u => ({ key: "u_" + u.id, type: "Sign-up", at: toDate(u.createdAt), who: s(u.name) || accountEmail(u) || accountPhone(u) || "(no name)", detail: ROLE_LABEL[u.role] || s(u.role), city: s(u.city) })),
    ...jobRows.map(j => ({ key: "j_" + j.id, type: "Job post", at: j.created, who: j.employer || "(no name)", detail: j.title, city: j.city, jobId: j.id })),
    ...applications.map(a => ({
      key: "a_" + a.id, type: isFromSearch(a) ? "Search shortlist" : "Application", at: toDate(a.createdAt), who: s(a.applicantName) || "(no name)",
      detail: [jobBy[a.jobId]?.title || s(a.jobSnapshot?.title) || "(job removed)", jobBy[a.jobId]?.employer || s(a.jobSnapshot?.businessName)].filter(Boolean).join(" · "),
      city: s(a.profileSnapshot?.city), jobId: jobBy[a.jobId] ? a.jobId : "", uid: s(a.applicantUid),
    })),
  ];
  return rows.filter(r => r.at).sort((a, b) => b.at - a.at).slice(0, max);
}

// ── Summary cards ────────────────────────────────────────────
export function summarise({ users, seekers, employers, businesses = [], jobRows, applications }, now = new Date()) {
  const today = ymd(now);
  const { start, end } = weekRange(now); // Monday–Sunday, as on the Employer Desk
  const accounts = users.map(u => ymd(toDate(u.createdAt)));
  return {
    seekers: seekers.length,
    seekersWithProfile: seekers.filter(x => x.hasProfile).length,
    businesses: businesses.length,
    businessesByState: Object.fromEntries(BUSINESS_STATES.map(([k]) => [k, businesses.filter(b => b.state === k).length])),
    employers: employers.length,
    employersPosting: employers.filter(e => e.jobs > 0).length,
    accounts: users.length,
    jobs: jobRows.length,
    jobsByState: Object.fromEntries(JOB_STATES.map(({ key }) => [key, jobRows.filter(j => j.state === key).length])),
    applications: applications.filter(a => !isFromSearch(a)).length,
    shortlists: applications.filter(isContactUnlocked).length,
    signupsToday: accounts.filter(d => d === today).length,
    signupsWeek: accounts.filter(d => d && d >= start && d <= end).length,
  };
}

// ── Search + filters ─────────────────────────────────────────
export const EMPTY_FILTERS = { q: "", city: "", role: "", lane: "", status: "", from: "", to: "" };
const norm = (v) => s(v).toLowerCase();

// Distinct values, ignoring case ("Pune" / "pune "), sorted; first spelling kept.
export function distinct(values) {
  const m = new Map();
  for (const v of values.map(s)) if (v && !m.has(norm(v))) m.set(norm(v), v);
  return [...m.values()].sort((a, b) => a.localeCompare(b));
}

// Every word must appear in the row's text. A search made only of digits also
// matches phone numbers written with spaces or +91.
export function matchesSearch(text, q) {
  const hay = norm(text);
  if (norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return true;
  const digits = s(q).replace(/[\s+()-]/g, "");
  return /^\d{4,}$/.test(digits) && hay.replace(/[\s+()-]/g, "").includes(digits);
}

// `text(row)` = searchable text, `roles(row)` = values the role filter matches.
export function filterRows(rows, f, { text, roles, status, lane, date = (r) => r.created }) {
  return rows.filter(r => {
    if (f.q && !matchesSearch(text(r), f.q)) return false;
    if (f.city && norm(r.city) !== norm(f.city)) return false;
    if (f.role && !roles(r).some(x => norm(x) === norm(f.role))) return false;
    if (f.status && status && status(r) !== f.status) return false;
    if (f.lane && lane && lane(r) !== f.lane) return false;
    if (f.from || f.to) {
      const d = ymd(date(r));
      if (!d || (f.from && d < f.from) || (f.to && d > f.to)) return false;
    }
    return true;
  });
}

export const SEEKER_FILTER = {
  text: (r) => [r.name, r.phone, r.email, r.city, r.areas, r.roleText, ...r.roles, ...r.skills].join(" "),
  roles: (r) => [r.role, ...r.roles],
  lane: (r) => r.lane,
  status: (r) => r.profile,
  date: (r) => r.joined,
};
export const BUSINESS_FILTER = {
  text: (r) => [r.business, r.contact, r.phone, r.email, r.city, r.type].join(" "),
  roles: (r) => [r.type],
  status: (r) => r.state,
};
export const JOB_FILTER = {
  text: (r) => [r.title, r.employer, r.city, ...r.roles, r.employerPhone, r.employerEmail].join(" "),
  roles: (r) => r.roles,
  status: (r) => r.state,
};

// ── Applicants of one job ────────────────────────────────────
// That application's own contact and resume first, the candidate's profile
// filling any gaps.
export function applicantRow(app, seeker, contact, stageLabel) {
  const c = contact || legacyContact(app) || {};
  const snap = app.profileSnapshot || {};
  return {
    id: app.id, uid: app.applicantUid, app,
    name: s(app.applicantName) || seeker?.name || "(no name)",
    phone: s(c.applicantPhone) || seeker?.phone || "",
    email: realEmail(c.applicantEmail) || seeker?.email || "",
    city: s(snap.city) || seeker?.city || "",
    roleText: s(snap.role) || seeker?.roleText || "",
    experienceYears: s(snap.experienceYears) || seeker?.experienceYears || "",
    expectedPay: s(app.expectedPay) || seeker?.expectedPay || "",
    resume: contactResume(app.applicantUid, c) || seeker?.resume || null,
    stageLabel: stageLabel(currentStage(app)),
    isShortlisted: isContactUnlocked(app),
    appliedOn: toDate(app.createdAt),
    fromSearch: isFromSearch(app),
  };
}

// ── Export rows ──────────────────────────────────────────────
// `link` = resume link already fetched for that row ("" when none).
export const seekerExport = (r, link = "") => ({
  Name: r.name, Mobile: r.phone, Email: r.email, City: r.city, "Work areas": r.areas,
  Lane: laneText(r.lane), "Profile complete": r.profile, Joined: ymd(r.joined),
  "Role / trade": r.roleText, "Functions / trades": r.roles.join(", "), Skills: r.skills.join(", "),
  "Experience (years)": r.experienceYears, "Expected pay": r.expectedPay, "Current pay": r.currentPay,
  "Pay hidden from employers": r.payHidden ? "Yes" : "",
  "Profile created": ymd(r.created), "Has job profile": r.hasProfile ? "Yes" : "No (applied only)",
  "Jobs applied": r.applied, "Times shortlisted": r.shortlisted, "Resume link": link,
});
export const businessExport = (r) => ({
  Business: r.business, Status: businessStateLabel(r.state), "Owner / contact": r.contact, Mobile: r.phone, Email: r.email, City: r.city, Type: r.type, "Deals in": r.dealsIn || "",
  Verified: r.verified, "Jobs posted": r.jobs, "Open jobs": r.openJobs,
  "Shortlists used": r.slots, "Shortlists available": hasLimit(r.slotsTotal) ? r.slotsTotal : "No limit (beta)", Joined: ymd(r.created),
});
export const approvalExport = (r) => ({
  Business: r.business, Kind: r.kindText, City: r.city, Owner: r.owner, Mobile: r.phone, Email: r.email, GST: r.gst,
  Sent: ymd(r.created), Note: r.blocked || r.warning,
});
export const activityExport = (r) => ({
  When: r.at ? `${ymd(r.at)} ${pad(r.at.getHours())}:${pad(r.at.getMinutes())}` : "", Type: r.type, Who: r.who, Detail: r.detail, City: r.city,
});
export const jobExport = (r) => ({
  Title: r.title, Employer: r.employer, "Employer mobile": r.employerPhone, "Employer email": r.employerEmail,
  City: r.city, Role: r.roles.join(", "), Pay: r.payText, Status: jobStateLabel(r.state), Posted: ymd(r.created),
  Applicants: r.applicants, "Shortlists used": shortlistText(r),
});
export const applicantExport = (job, a, link = "") => ({
  Job: job.title, Employer: job.employer, "Job city": job.city,
  Name: a.name, Mobile: a.phone, Email: a.email, City: a.city, "Role / trade": a.roleText,
  "Experience (years)": a.experienceYears, "Expected pay": a.expectedPay,
  Stage: a.stageLabel, Shortlisted: a.isShortlisted ? "Yes" : "No", Applied: a.fromSearch ? "" : ymd(a.appliedOn), "Found in search": a.fromSearch ? ymd(a.appliedOn) : "", "Resume link": link,
});
