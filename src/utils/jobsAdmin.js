// Admin → TIN Jobs Admin: turns the raw collections into the rows, counts and
// filters the screens show. Plain functions, zero React/Firebase imports —
// unit-tested in test/unit/jobsAdmin.test.js. Reads: src/lib/jobsAdmin.js.
//
// Who counts as what (docs/JOBS_BLUEPRINT.md §10):
//  - job seeker: has a job profile, or applied to at least one job;
//  - employer:   posted a job, or the account is a business (retailer role, or
//                linked to a store — the same signals as utils/jobRoles.js).
// One account can be both.
import { FUNCS, INDUSTRIES, TRADES, labelOf } from "../data/jobsTaxonomy.js";
import { currentStage, isContactUnlocked } from "./applications.js";
import { vacancyTab, weekRange } from "./employerDesk.js";
import { normaliseJob } from "./jobModel.js";
import { isEmployerByAccount } from "./jobRoles.js";
import { isSyntheticPhoneEmail } from "./phoneAuth.js";
import { isShortlistFull, shortlistCountOf } from "./shortlist.js";

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
  { key: "pending", label: "In review" },
  { key: "rejected", label: "Rejected" },
];
export const jobStateLabel = (k) => JOB_STATES.find(x => x.key === k)?.label || k;
// Same order as the Employer Desk: paused / filled / closed win; a job that
// isn't approved yet is in review (or rejected), never "open".
export function jobState(job) {
  const tab = vacancyTab(job);
  if (tab !== "live") return tab;
  return job?.status === "approved" ? "open" : job?.status === "rejected" ? "rejected" : "pending";
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
export const shortlistText = (j) => `${j.slots}/${j.limit}`;

// ── Job seekers ──────────────────────────────────────────────
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
      snapshot: src,
      created: toDate(p?.createdAt) || toDate(u?.createdAt) || toDate(apps[apps.length - 1]?.createdAt),
      resume: resumeSource(uid, { path: q.cv?.path, fileName: q.cv?.fileName })
        || cs.map(c => contactResume(uid, c)).find(Boolean) || null,
      applications: apps,
      applied: apps.length,
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
const ROLE_LABEL = { retailer: "Retailer", contractor: "Contractor", architect: "Architect", contributor: "Market Champion", consumer: "Individual" };

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

// ── Summary cards ────────────────────────────────────────────
export function summarise({ users, seekers, employers, jobRows, applications }, now = new Date()) {
  const today = ymd(now);
  const { start, end } = weekRange(now); // Monday–Sunday, as on the Employer Desk
  const accounts = users.map(u => ymd(toDate(u.createdAt)));
  return {
    seekers: seekers.length,
    seekersWithProfile: seekers.filter(x => x.hasProfile).length,
    employers: employers.length,
    employersPosting: employers.filter(e => e.jobs > 0).length,
    accounts: users.length,
    jobs: jobRows.length,
    jobsByState: Object.fromEntries(JOB_STATES.map(({ key }) => [key, jobRows.filter(j => j.state === key).length])),
    applications: applications.length,
    shortlists: applications.filter(isContactUnlocked).length,
    signupsToday: accounts.filter(d => d === today).length,
    signupsWeek: accounts.filter(d => d && d >= start && d <= end).length,
  };
}

// ── Search + filters ─────────────────────────────────────────
export const EMPTY_FILTERS = { q: "", city: "", role: "", status: "", from: "", to: "" };
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
export function filterRows(rows, f, { text, roles, status }) {
  return rows.filter(r => {
    if (f.q && !matchesSearch(text(r), f.q)) return false;
    if (f.city && norm(r.city) !== norm(f.city)) return false;
    if (f.role && !roles(r).some(x => norm(x) === norm(f.role))) return false;
    if (f.status && status && status(r) !== f.status) return false;
    if (f.from || f.to) {
      const d = ymd(r.created);
      if (!d || (f.from && d < f.from) || (f.to && d > f.to)) return false;
    }
    return true;
  });
}

export const SEEKER_FILTER = {
  text: (r) => [r.name, r.phone, r.email, r.city, r.areas, r.roleText, ...r.roles, ...r.skills].join(" "),
  roles: (r) => [r.role, ...r.roles],
};
export const EMPLOYER_FILTER = {
  text: (r) => [r.business, r.contact, r.phone, r.email, r.city, r.type].join(" "),
  roles: (r) => [r.type],
  status: (r) => r.verified,
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
  };
}

// ── Export rows ──────────────────────────────────────────────
// `link` = resume link already fetched for that row ("" when none).
export const seekerExport = (r, link = "") => ({
  Name: r.name, Mobile: r.phone, Email: r.email, City: r.city, "Work areas": r.areas,
  "Role / trade": r.roleText, "Functions / trades": r.roles.join(", "), Skills: r.skills.join(", "),
  "Experience (years)": r.experienceYears, "Expected pay": r.expectedPay, "Current pay": r.currentPay,
  "Pay hidden from employers": r.payHidden ? "Yes" : "",
  "Profile created": ymd(r.created), "Has job profile": r.hasProfile ? "Yes" : "No (applied only)",
  "Jobs applied": r.applied, "Times shortlisted": r.shortlisted, "Resume link": link,
});
export const employerExport = (r) => ({
  Business: r.business, "Contact name": r.contact, Mobile: r.phone, Email: r.email, City: r.city, Type: r.type,
  Verified: r.verified, "Jobs posted": r.jobs, "Open jobs": r.openJobs,
  "Shortlists used": r.slots, "Shortlists available": r.slotsTotal, Created: ymd(r.created),
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
  Stage: a.stageLabel, Shortlisted: a.isShortlisted ? "Yes" : "No", Applied: ymd(a.appliedOn), "Resume link": link,
});
